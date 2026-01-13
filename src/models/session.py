"""Session management for secure authentication."""

from datetime import datetime, timedelta
from typing import Optional
import secrets

from sqlalchemy import Column, DateTime, Integer, String, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.config.database import Base


class Session(Base):
    """Session model for tracking user sessions."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)

    # Session identification
    session_token = Column(String(255), unique=True, nullable=False, index=True)

    # User relationship
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", backref="sessions")

    # Session metadata
    created_at = Column(DateTime, default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    last_accessed = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Security metadata
    ip_address = Column(String(45), nullable=True)  # IPv6 max length
    user_agent = Column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<Session(id={self.id}, user_id={self.user_id}, token='{self.session_token[:8]}...')>"

    @staticmethod
    def generate_token() -> str:
        """Generate a cryptographically secure session token.

        Returns:
            Secure random session token
        """
        return secrets.token_urlsafe(32)

    @staticmethod
    def create_expiry(hours: int = 24) -> datetime:
        """Create an expiration datetime.

        Args:
            hours: Number of hours until expiration (default: 24)

        Returns:
            Expiration datetime
        """
        return datetime.utcnow() + timedelta(hours=hours)

    def is_expired(self) -> bool:
        """Check if session has expired.

        Returns:
            True if expired, False otherwise
        """
        return datetime.utcnow() > self.expires_at

    def extend_expiry(self, hours: int = 24) -> None:
        """Extend the session expiration.

        Args:
            hours: Number of hours to extend (default: 24)
        """
        self.expires_at = datetime.utcnow() + timedelta(hours=hours)
        self.last_accessed = datetime.utcnow()

    def to_dict(self) -> dict:
        """Convert session to dictionary.

        Returns:
            Dictionary representation of session
        """
        return {
            "id": self.id,
            "session_token": self.session_token,
            "user_id": self.user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_accessed": self.last_accessed.isoformat() if self.last_accessed else None,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "is_expired": self.is_expired(),
        }
