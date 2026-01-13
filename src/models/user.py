"""User authentication and authorization models."""

from datetime import datetime
from typing import Optional
import enum

from sqlalchemy import Column, DateTime, Integer, String, Boolean, Float, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import validates, relationship
from passlib.context import CryptContext

from src.config.database import Base

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserRole(str, enum.Enum):
    """User roles for RBAC."""
    ADMIN = "admin"  # Full access - manage users, all data, system settings
    EDITOR = "editor"  # Read/write access - view and modify incidents, trigger refreshes
    OPERATOR = "operator"  # Limited write access - view data, trigger refreshes only
    VIEWER = "viewer"  # Read-only access - view incidents and events only


class User(Base):
    """User model for authentication and authorization."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Authentication
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Authorization (legacy role field kept for backwards compatibility)
    role = Column(String(50), default=UserRole.VIEWER.value, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Enterprise RBAC fields
    is_super_admin = Column(Boolean, default=False, nullable=False, index=True)
    primary_organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)

    # Metadata
    full_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime, nullable=True)
    created_by = Column(Integer, nullable=True)  # User ID of creator (for audit)

    # OAuth 2.0 fields
    oauth_provider = Column(String(50), nullable=True)  # 'google', 'github', etc.
    oauth_id = Column(String(255), nullable=True, index=True)  # Provider's user ID
    oauth_access_token = Column(Text, nullable=True)  # Encrypted access token
    oauth_refresh_token = Column(Text, nullable=True)  # Encrypted refresh token
    profile_picture_url = Column(String(500), nullable=True)

    # MFA fields
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    duo_user_id = Column(String(255), nullable=True)  # Duo Security user ID

    # AI Preferences (no default - will be auto-detected based on configured providers)
    preferred_model = Column(String(100), default=None, nullable=True)
    ai_temperature = Column(Float, default=0.7, nullable=True)
    ai_max_tokens = Column(Integer, default=4096, nullable=True)

    # User-provided API keys (encrypted)
    user_anthropic_api_key = Column(Text, nullable=True)
    user_openai_api_key = Column(Text, nullable=True)
    user_google_api_key = Column(Text, nullable=True)
    user_cisco_client_id = Column(Text, nullable=True)  # Encrypted Cisco OAuth Client ID
    user_cisco_client_secret = Column(Text, nullable=True)  # Encrypted Cisco OAuth Client Secret

    # Relationships
    primary_organization = relationship("Organization", foreign_keys=[primary_organization_id])

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"

    @validates("role")
    def validate_role(self, key: str, value: str) -> str:
        """Validate that role is a valid UserRole value."""
        valid_roles = [r.value for r in UserRole]
        if value not in valid_roles:
            raise ValueError(f"Invalid role: {value}. Must be one of {valid_roles}")
        return value

    @property
    def role_enum(self) -> UserRole:
        """Get role as UserRole enum."""
        return UserRole(self.role)

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt.

        Args:
            password: Plain text password

        Returns:
            Hashed password
        """
        # bcrypt has a 72 byte limit - truncate if necessary
        password_bytes = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        return pwd_context.hash(password_bytes)

    def verify_password(self, password: str) -> bool:
        """Verify a password against the stored hash.

        Args:
            password: Plain text password to verify

        Returns:
            True if password matches, False otherwise
        """
        # bcrypt has a 72 byte limit - truncate if necessary
        password_bytes = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        return pwd_context.verify(password_bytes, self.hashed_password)

    def has_permission(self, required_role: UserRole) -> bool:
        """Check if user has required permission level.

        Args:
            required_role: Minimum required role

        Returns:
            True if user has permission, False otherwise
        """
        if not self.is_active:
            return False

        # Role hierarchy (higher index = more permissions)
        role_hierarchy = [
            UserRole.VIEWER,
            UserRole.OPERATOR,
            UserRole.EDITOR,
            UserRole.ADMIN,
        ]

        user_level = role_hierarchy.index(self.role_enum)
        required_level = role_hierarchy.index(required_role)

        return user_level >= required_level

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert user to dictionary.

        Args:
            include_sensitive: Include sensitive fields like hashed_password

        Returns:
            Dictionary representation of user
        """
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role.value if isinstance(self.role, UserRole) else self.role,
            "is_active": self.is_active,
            "is_super_admin": self.is_super_admin,
            "primary_organization_id": self.primary_organization_id,
            "full_name": self.full_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_by": self.created_by,
            "preferred_model": self.preferred_model,
            "ai_temperature": self.ai_temperature,
            "ai_max_tokens": self.ai_max_tokens,
            "has_anthropic_key": bool(self.user_anthropic_api_key),
            "has_openai_key": bool(self.user_openai_api_key),
            "has_google_key": bool(self.user_google_api_key),
            "has_cisco_key": bool(self.user_cisco_client_id and self.user_cisco_client_secret),
        }

        if include_sensitive:
            data["hashed_password"] = self.hashed_password

        return data
