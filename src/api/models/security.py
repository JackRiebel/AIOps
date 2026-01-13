"""Pydantic models for security configuration."""

from typing import Optional, List
from pydantic import BaseModel


class SecurityConfigUpdate(BaseModel):
    """Request model for updating security configuration."""
    edit_mode_enabled: Optional[bool] = None
    allowed_operations: Optional[List[str]] = None
    audit_logging: Optional[bool] = None


class EditModeUpdate(BaseModel):
    """Request model for updating edit mode."""
    enabled: bool
