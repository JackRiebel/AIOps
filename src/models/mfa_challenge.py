"""Model for MFA authentication challenges."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from src.config.database import Base

# Challenges expire after 5 minutes
MFA_CHALLENGE_TTL_SECONDS = 300


class MfaChallenge(Base):
    """Persisted MFA challenge — replaces the old in-memory dict.

    Each row represents a single Duo MFA challenge issued during login.
    Challenges are consumed (deleted) after successful verification.
    """

    __tablename__ = "mfa_challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    username = Column(String(255), nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(seconds=MFA_CHALLENGE_TTL_SECONDS),
        nullable=False,
    )
