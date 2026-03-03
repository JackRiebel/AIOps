"""Duo Security MFA service for two-factor authentication."""

import logging
import time
import hmac
import hashlib
import base64
import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple
from urllib.parse import urlencode

import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings
from src.models.mfa_challenge import MfaChallenge, MFA_CHALLENGE_TTL_SECONDS
from src.services.config_service import get_config_or_env

logger = logging.getLogger(__name__)


def _get_duo_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Get Duo credentials from database first, then fall back to settings.

    Returns:
        Tuple of (integration_key, secret_key, api_hostname)
    """
    settings = get_settings()

    integration_key = (
        get_config_or_env("duo_integration_key", "DUO_INTEGRATION_KEY") or
        settings.duo_integration_key
    )
    secret_key = (
        get_config_or_env("duo_secret_key", "DUO_SECRET_KEY") or
        settings.duo_secret_key
    )
    api_hostname = (
        get_config_or_env("duo_api_hostname", "DUO_API_HOSTNAME") or
        settings.duo_api_hostname
    )

    return integration_key, secret_key, api_hostname


class DuoMFAService:
    """Service for handling Duo Security MFA authentication."""

    @staticmethod
    def is_configured() -> bool:
        """Check if Duo MFA is configured."""
        integration_key, secret_key, api_hostname = _get_duo_credentials()
        return bool(integration_key and secret_key and api_hostname)

    @staticmethod
    def is_enabled() -> bool:
        """Check if MFA is enabled globally."""
        settings = get_settings()
        return settings.mfa_enabled and DuoMFAService.is_configured()

    @staticmethod
    def _sign_request(method: str, host: str, path: str, params: dict) -> str:
        """Sign a Duo API request.

        Args:
            method: HTTP method
            host: API hostname
            path: API path
            params: Request parameters

        Returns:
            Authorization header value
        """
        integration_key, secret_key, _ = _get_duo_credentials()

        # Sort and encode params
        param_string = urlencode(sorted(params.items()))

        # Create string to sign
        timestamp = str(int(time.time()))
        string_to_sign = "\n".join([
            timestamp,
            method.upper(),
            host.lower(),
            path,
            param_string,
        ])

        # Sign with HMAC-SHA1
        signature = hmac.new(
            secret_key.encode(),
            string_to_sign.encode(),
            hashlib.sha1,
        ).hexdigest()

        # Create Authorization header
        auth = f"{integration_key}:{signature}"
        return f"Basic {base64.b64encode(auth.encode()).decode()}", timestamp

    @staticmethod
    async def check_user(username: str) -> dict:
        """Check if a user exists in Duo and get their status.

        Args:
            username: Username to check

        Returns:
            User status dict
        """
        if not DuoMFAService.is_configured():
            return {"result": "allow", "status": "not_configured"}

        _, _, api_hostname = _get_duo_credentials()
        host = api_hostname
        path = "/auth/v2/preauth"
        params = {"username": username}

        auth_header, timestamp = DuoMFAService._sign_request("POST", host, path, params)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://{host}{path}",
                headers={
                    "Authorization": auth_header,
                    "Date": timestamp,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data=params,
            )

            if response.status_code != 200:
                logger.error(f"Duo preauth failed: {response.text}")
                # On error, allow auth (fail open) to prevent lockouts
                return {"result": "allow", "status": "error"}

            result = response.json()
            return result.get("response", {"result": "allow"})

    @staticmethod
    async def create_challenge(db: AsyncSession, user_id: int, username: str) -> str:
        """Create an MFA challenge for a user (persisted in DB).

        Args:
            db: Async database session
            user_id: User's database ID
            username: Username

        Returns:
            Challenge ID
        """
        challenge_id = secrets.token_urlsafe(32)
        row = MfaChallenge(
            challenge_id=challenge_id,
            user_id=user_id,
            username=username,
        )
        db.add(row)
        await db.commit()
        return challenge_id

    @staticmethod
    async def get_challenge(db: AsyncSession, challenge_id: str) -> Optional[dict]:
        """Get a pending MFA challenge from the database.

        Args:
            db: Async database session
            challenge_id: Challenge ID

        Returns:
            Challenge data dict or None
        """
        result = await db.execute(
            select(MfaChallenge).where(
                MfaChallenge.challenge_id == challenge_id,
                MfaChallenge.expires_at > datetime.utcnow(),
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return {
            "user_id": row.user_id,
            "username": row.username,
            "verified": row.verified,
            "created_at": row.created_at,
        }

    @staticmethod
    async def consume_challenge(db: AsyncSession, challenge_id: str) -> Optional[dict]:
        """Consume (verify and remove) an MFA challenge.

        Args:
            db: Async database session
            challenge_id: Challenge ID

        Returns:
            Challenge data or None
        """
        challenge = await DuoMFAService.get_challenge(db, challenge_id)
        if challenge and challenge.get("verified"):
            await db.execute(
                delete(MfaChallenge).where(MfaChallenge.challenge_id == challenge_id)
            )
            await db.commit()
            return challenge
        return None

    @staticmethod
    async def send_push(username: str, device: str = "auto") -> dict:
        """Send a Duo Push notification to user's device.

        Args:
            username: Username
            device: Device to send push to ('auto' for default device)

        Returns:
            Push result
        """
        if not DuoMFAService.is_configured():
            return {"result": "allow", "status": "not_configured"}

        _, _, api_hostname = _get_duo_credentials()
        host = api_hostname
        path = "/auth/v2/auth"
        params = {
            "username": username,
            "factor": "push",
            "device": device,
        }

        auth_header, timestamp = DuoMFAService._sign_request("POST", host, path, params)

        async with httpx.AsyncClient(timeout=90.0) as client:  # Duo push can take time
            response = await client.post(
                f"https://{host}{path}",
                headers={
                    "Authorization": auth_header,
                    "Date": timestamp,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data=params,
            )

            if response.status_code != 200:
                logger.error(f"Duo auth failed: {response.text}")
                return {"result": "deny", "status": "error", "message": "MFA request failed"}

            result = response.json()
            return result.get("response", {"result": "deny"})

    @staticmethod
    async def verify_passcode(username: str, passcode: str) -> dict:
        """Verify a Duo passcode (from hardware token or app).

        Args:
            username: Username
            passcode: Passcode to verify

        Returns:
            Verification result
        """
        if not DuoMFAService.is_configured():
            return {"result": "allow", "status": "not_configured"}

        _, _, api_hostname = _get_duo_credentials()
        host = api_hostname
        path = "/auth/v2/auth"
        params = {
            "username": username,
            "factor": "passcode",
            "passcode": passcode,
        }

        auth_header, timestamp = DuoMFAService._sign_request("POST", host, path, params)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://{host}{path}",
                headers={
                    "Authorization": auth_header,
                    "Date": timestamp,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data=params,
            )

            if response.status_code != 200:
                logger.error(f"Duo passcode verification failed: {response.text}")
                return {"result": "deny", "status": "error", "message": "Verification failed"}

            result = response.json()
            return result.get("response", {"result": "deny"})

    @staticmethod
    async def enroll_user(username: str, email: str) -> dict:
        """Enroll a new user in Duo (requires Duo Admin API).

        Note: This requires the Admin API, not Auth API.
        For simplicity, users can self-enroll via Duo's enrollment portal.

        Args:
            username: Username to enroll
            email: User's email

        Returns:
            Enrollment result
        """
        # For now, return instructions for self-enrollment
        # Full Admin API enrollment requires additional Duo configuration
        return {
            "result": "pending",
            "message": "Please complete enrollment through Duo's self-service portal",
            "enrollment_required": True,
        }

    @staticmethod
    async def mark_challenge_verified(db: AsyncSession, challenge_id: str) -> bool:
        """Mark an MFA challenge as verified.

        Args:
            db: Async database session
            challenge_id: Challenge ID

        Returns:
            True if challenge was found and marked
        """
        result = await db.execute(
            select(MfaChallenge).where(
                MfaChallenge.challenge_id == challenge_id,
                MfaChallenge.expires_at > datetime.utcnow(),
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.verified = True
            await db.commit()
            return True
        return False

    @staticmethod
    async def cleanup_expired(db: AsyncSession) -> int:
        """Delete expired MFA challenges.

        Returns:
            Number of rows deleted
        """
        result = await db.execute(
            delete(MfaChallenge).where(MfaChallenge.expires_at <= datetime.utcnow())
        )
        await db.commit()
        return result.rowcount
