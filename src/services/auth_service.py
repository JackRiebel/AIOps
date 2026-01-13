"""Authentication service for user login, session management, and authorization."""

import logging
from datetime import datetime
from typing import Optional
from fastapi import Request, HTTPException, status

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.user import User, UserRole
from src.models.session import Session

logger = logging.getLogger(__name__)

class AuthService:
    """Service for handling authentication and session management."""

    SESSION_COOKIE_NAME = "lumen_session"
    SESSION_DURATION_HOURS = 24

    @staticmethod
    async def create_user(
        session: AsyncSession,
        username: str,
        email: str,
        password: str,
        role: UserRole = UserRole.VIEWER,
        full_name: Optional[str] = None,
        created_by: Optional[int] = None,
    ) -> User:
        """Create a new user.

        Args:
            session: Database session
            username: Unique username
            email: Unique email address
            password: Plain text password (will be hashed)
            role: User role (default: VIEWER)
            full_name: Optional full name
            created_by: User ID of creator (for audit trail)

        Returns:
            Created user

        Raises:
            ValueError: If username or email already exists
        """
        # Check if username exists
        result = await session.execute(
            select(User).where(User.username == username)
        )
        if result.scalar_one_or_none():
            raise ValueError(f"Username '{username}' already exists")

        # Check if email exists
        result = await session.execute(
            select(User).where(User.email == email)
        )
        if result.scalar_one_or_none():
            raise ValueError(f"Email '{email}' already exists")

        # Create user
        user = User(
            username=username,
            email=email,
            hashed_password=User.hash_password(password),
            role=role,
            full_name=full_name,
            created_by=created_by,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)

        logger.info(f"User created: {username} ({email}) with role {role.value}")
        return user

    @staticmethod
    async def authenticate_user(
        session: AsyncSession,
        username: str,
        password: str,
    ) -> Optional[User]:
        """Authenticate a user with username/email and password.

        Args:
            session: Database session
            username: Username or email address
            password: Plain text password

        Returns:
            User object if authentication successful, None otherwise
        """
        from sqlalchemy import or_, func

        # Find user by username OR email (case-insensitive email match)
        result = await session.execute(
            select(User).where(
                or_(
                    User.username == username,
                    func.lower(User.email) == username.lower()
                )
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"Authentication failed: user '{username}' not found")
            return None

        if not user.is_active:
            logger.warning(f"Authentication failed: user '{username}' is inactive")
            return None

        if not user.verify_password(password):
            logger.warning(f"Authentication failed: invalid password for user '{username}'")
            return None

        logger.info(f"User authenticated: {username}")
        return user

    @staticmethod
    async def create_session(
        session: AsyncSession,
        user: User,
        request: Request,
    ) -> Session:
        """Create a new session for a user.

        Args:
            session: Database session
            user: User object
            request: FastAPI request (for IP and user agent)

        Returns:
            Created session
        """
        # Generate session token
        session_token = Session.generate_token()

        # Get client info
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # Create session
        user_session = Session(
            session_token=session_token,
            user_id=user.id,
            expires_at=Session.create_expiry(hours=AuthService.SESSION_DURATION_HOURS),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(user_session)
        await session.flush()
        await session.refresh(user_session)

        # Update user's last login
        user.last_login = datetime.utcnow()

        logger.info(f"Session created for user {user.username} (ID: {user.id})")
        return user_session

    @staticmethod
    async def get_session_by_token(
        session: AsyncSession,
        token: str,
    ) -> Optional[Session]:
        """Get a session by token.

        Args:
            session: Database session
            token: Session token

        Returns:
            Session object if found and valid, None otherwise
        """
        result = await session.execute(
            select(Session).where(Session.session_token == token)
        )
        user_session = result.scalar_one_or_none()

        if not user_session:
            return None

        # Check if expired
        if user_session.is_expired():
            logger.debug(f"Session {token[:8]}... is expired")
            return None

        # Extend session expiry on access
        user_session.extend_expiry(hours=AuthService.SESSION_DURATION_HOURS)

        return user_session

    @staticmethod
    async def get_user_from_session(
        session: AsyncSession,
        session_token: str,
    ) -> Optional[User]:
        """Get user from session token.

        Args:
            session: Database session
            session_token: Session token

        Returns:
            User object if session is valid, None otherwise
        """
        user_session = await AuthService.get_session_by_token(session, session_token)
        if not user_session:
            return None

        # Get user
        result = await session.execute(
            select(User).where(User.id == user_session.user_id)
        )
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            return None

        return user

    @staticmethod
    async def delete_session(
        session: AsyncSession,
        session_token: str,
    ) -> bool:
        """Delete a session (logout).

        Args:
            session: Database session
            session_token: Session token

        Returns:
            True if session was deleted, False otherwise
        """
        result = await session.execute(
            select(Session).where(Session.session_token == session_token)
        )
        user_session = result.scalar_one_or_none()

        if not user_session:
            return False

        await session.delete(user_session)
        logger.info(f"Session deleted: {session_token[:8]}...")
        return True

    @staticmethod
    async def delete_all_user_sessions(
        session: AsyncSession,
        user_id: int,
    ) -> int:
        """Delete all sessions for a user.

        Args:
            session: Database session
            user_id: User ID

        Returns:
            Number of sessions deleted
        """
        result = await session.execute(
            select(Session).where(Session.user_id == user_id)
        )
        sessions = result.scalars().all()

        count = 0
        for user_session in sessions:
            await session.delete(user_session)
            count += 1

        logger.info(f"Deleted {count} sessions for user ID {user_id}")
        return count

    @staticmethod
    async def cleanup_expired_sessions(session: AsyncSession) -> int:
        """Clean up expired sessions.

        Args:
            session: Database session

        Returns:
            Number of sessions deleted
        """
        result = await session.execute(
            select(Session).where(Session.expires_at < datetime.utcnow())
        )
        expired_sessions = result.scalars().all()

        count = 0
        for user_session in expired_sessions:
            await session.delete(user_session)
            count += 1

        if count > 0:
            logger.info(f"Cleaned up {count} expired sessions")

        return count
