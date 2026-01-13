"""Role model for RBAC."""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import Column, DateTime, Integer, String, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.config.database import Base

if TYPE_CHECKING:
    from src.models.permission import Permission, RolePermission
    from src.models.organization import Organization


class Role(Base):
    """Role model for role-based access control."""

    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    priority = Column(Integer, default=0, nullable=False, index=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="roles")
    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    user_organizations = relationship("UserOrganization", back_populates="role")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}', priority={self.priority})>"

    @property
    def permission_codes(self) -> List[str]:
        """Get list of permission codes assigned to this role."""
        return [rp.permission.code for rp in self.role_permissions if rp.permission]

    def has_permission(self, permission_code: str) -> bool:
        """Check if role has a specific permission."""
        return permission_code in self.permission_codes

    def to_dict(self, include_permissions: bool = True) -> dict:
        """Convert role to dictionary."""
        data = {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "is_system": self.is_system,
            "is_active": self.is_active,
            "organization_id": self.organization_id,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_permissions:
            data["permissions"] = self.permission_codes
            data["permission_count"] = len(self.role_permissions)

        return data


class RoleChangeRequest(Base):
    """Role change request for approval workflows."""

    __tablename__ = "role_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    current_role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    requested_role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="pending", nullable=False, index=True)
    reason = Column(Text, nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    requester = relationship("User", foreign_keys=[requester_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    organization = relationship("Organization")
    current_role = relationship("Role", foreign_keys=[current_role_id])
    requested_role = relationship("Role", foreign_keys=[requested_role_id])

    def __repr__(self) -> str:
        return f"<RoleChangeRequest(id={self.id}, target_user={self.target_user_id}, status='{self.status}')>"

    @property
    def is_expired(self) -> bool:
        """Check if request has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_pending(self) -> bool:
        """Check if request is still pending."""
        return self.status == "pending" and not self.is_expired

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "requester_id": self.requester_id,
            "requester_name": self.requester.username if self.requester else None,
            "target_user_id": self.target_user_id,
            "target_user_name": self.target_user.username if self.target_user else None,
            "organization_id": self.organization_id,
            "organization_name": self.organization.name if self.organization else None,
            "current_role_id": self.current_role_id,
            "current_role_name": self.current_role.display_name if self.current_role else None,
            "requested_role_id": self.requested_role_id,
            "requested_role_name": self.requested_role.display_name if self.requested_role else None,
            "status": self.status,
            "reason": self.reason,
            "reviewer_id": self.reviewer_id,
            "reviewer_name": self.reviewer.username if self.reviewer else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "review_notes": self.review_notes,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_expired": self.is_expired,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
