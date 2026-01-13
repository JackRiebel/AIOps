"""Organization model for multi-tenancy support."""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import Column, DateTime, Integer, String, Boolean, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.config.database import Base

if TYPE_CHECKING:
    from src.models.user import User
    from src.models.role import Role


class Organization(Base):
    """Organization model for multi-tenant support."""

    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(255), nullable=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    parent_organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    settings = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    parent = relationship("Organization", remote_side=[id], backref="children")
    roles = relationship("Role", back_populates="organization", cascade="all, delete-orphan")
    user_memberships = relationship("UserOrganization", back_populates="organization", cascade="all, delete-orphan")
    access_restrictions = relationship("AccessRestriction", back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name='{self.name}', slug='{self.slug}')>"

    @property
    def member_count(self) -> int:
        """Get count of members in organization."""
        return len(self.user_memberships)

    def to_dict(self, include_members: bool = False) -> dict:
        """Convert organization to dictionary."""
        data = {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name or self.name,
            "slug": self.slug,
            "parent_organization_id": self.parent_organization_id,
            "settings": self.settings,
            "is_active": self.is_active,
            "member_count": self.member_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_members:
            data["members"] = [
                {
                    "user_id": m.user_id,
                    "username": m.user.username if m.user else None,
                    "role_id": m.role_id,
                    "role_name": m.role.display_name if m.role else None,
                    "is_primary": m.is_primary,
                    "joined_at": m.joined_at.isoformat() if m.joined_at else None,
                }
                for m in self.user_memberships
            ]

        return data


class UserOrganization(Base):
    """User-Organization membership with role assignment."""

    __tablename__ = "user_organizations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False, index=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    joined_at = Column(DateTime, default=func.now(), nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="organization_memberships")
    organization = relationship("Organization", back_populates="user_memberships")
    role = relationship("Role", back_populates="user_organizations")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self) -> str:
        return f"<UserOrganization(user_id={self.user_id}, org_id={self.organization_id}, role_id={self.role_id})>"

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "organization_id": self.organization_id,
            "organization_name": self.organization.name if self.organization else None,
            "organization_slug": self.organization.slug if self.organization else None,
            "role_id": self.role_id,
            "role_name": self.role.display_name if self.role else None,
            "is_primary": self.is_primary,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }


class UserDelegation(Base):
    """Temporary permission delegation between users."""

    __tablename__ = "user_delegations"

    id = Column(Integer, primary_key=True, index=True)
    delegator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    delegate_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    scope = Column(JSON, nullable=False)  # {"permissions": [...], "resources": [...]}
    starts_at = Column(DateTime, default=func.now(), nullable=False)
    ends_at = Column(DateTime, nullable=False)
    reason = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    delegator = relationship("User", foreign_keys=[delegator_id], backref="delegations_given")
    delegate = relationship("User", foreign_keys=[delegate_id], backref="delegations_received")
    organization = relationship("Organization")
    revoker = relationship("User", foreign_keys=[revoked_by])

    def __repr__(self) -> str:
        return f"<UserDelegation(id={self.id}, delegator={self.delegator_id}, delegate={self.delegate_id})>"

    @property
    def is_expired(self) -> bool:
        """Check if delegation has expired."""
        return datetime.utcnow() > self.ends_at

    @property
    def is_effective(self) -> bool:
        """Check if delegation is currently effective."""
        now = datetime.utcnow()
        return (
            self.is_active
            and not self.revoked_at
            and self.starts_at <= now <= self.ends_at
        )

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "delegator_id": self.delegator_id,
            "delegator_name": self.delegator.username if self.delegator else None,
            "delegate_id": self.delegate_id,
            "delegate_name": self.delegate.username if self.delegate else None,
            "organization_id": self.organization_id,
            "organization_name": self.organization.name if self.organization else None,
            "scope": self.scope,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "reason": self.reason,
            "is_active": self.is_active,
            "is_effective": self.is_effective,
            "is_expired": self.is_expired,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
        }


class AccessRestriction(Base):
    """IP/geo/time-based access restrictions."""

    __tablename__ = "access_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    restriction_type = Column(String(50), nullable=False, index=True)  # ip_whitelist, ip_blacklist, geo_allow, geo_deny, time_window
    name = Column(String(255), nullable=True)
    value = Column(JSON, nullable=False)  # {"ranges": [...]} for IP, {"countries": [...]} for geo, {"windows": [...]} for time
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    priority = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="access_restrictions")
    organization = relationship("Organization", back_populates="access_restrictions")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<AccessRestriction(id={self.id}, type='{self.restriction_type}', target={'user:' + str(self.user_id) if self.user_id else 'org:' + str(self.organization_id)})>"

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "organization_id": self.organization_id,
            "restriction_type": self.restriction_type,
            "name": self.name,
            "value": self.value,
            "is_active": self.is_active,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PermissionAuditLog(Base):
    """Audit log for permission checks."""

    __tablename__ = "permission_audit_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False, index=True)  # check, grant, revoke, deny
    permission_code = Column(String(100), nullable=True, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(255), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    result = Column(Boolean, nullable=True, index=True)
    reason = Column(String(255), nullable=True)
    context = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    timestamp = Column(DateTime, default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    organization = relationship("Organization")

    def __repr__(self) -> str:
        return f"<PermissionAuditLog(id={self.id}, user={self.user_id}, action='{self.action}', result={self.result})>"

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "action": self.action,
            "permission_code": self.permission_code,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "organization_id": self.organization_id,
            "result": self.result,
            "reason": self.reason,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
