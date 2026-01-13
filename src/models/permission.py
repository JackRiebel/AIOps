"""Permission model for granular RBAC."""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import Column, DateTime, Integer, String, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.config.database import Base

if TYPE_CHECKING:
    from src.models.role import Role


class Permission(Base):
    """Permission model for granular access control."""

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True, index=True)
    is_system = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")
    user_resource_permissions = relationship("UserResourcePermission", back_populates="permission", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Permission(id={self.id}, code='{self.code}', category='{self.category}')>"

    def to_dict(self) -> dict:
        """Convert permission to dictionary."""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "resource_type": self.resource_type,
            "is_system": self.is_system,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class RolePermission(Base):
    """Role-Permission mapping model."""

    __tablename__ = "role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_at = Column(DateTime, default=func.now(), nullable=False)
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

    def __repr__(self) -> str:
        return f"<RolePermission(role_id={self.role_id}, permission_id={self.permission_id})>"


class UserResourcePermission(Base):
    """User-specific resource permissions with optional expiration."""

    __tablename__ = "user_resource_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=False)
    granted_at = Column(DateTime, default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=True, index=True)
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="resource_permissions")
    permission = relationship("Permission", back_populates="user_resource_permissions")
    granter = relationship("User", foreign_keys=[granted_by])

    def __repr__(self) -> str:
        return f"<UserResourcePermission(user_id={self.user_id}, permission_id={self.permission_id}, resource={self.resource_type}:{self.resource_id})>"

    @property
    def is_expired(self) -> bool:
        """Check if permission has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "permission_id": self.permission_id,
            "permission_code": self.permission.code if self.permission else None,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "granted_at": self.granted_at.isoformat() if self.granted_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_expired": self.is_expired,
            "reason": self.reason,
        }
