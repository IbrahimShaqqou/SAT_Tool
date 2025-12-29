"""
SAT Tutoring Platform - Invite Model

Assessment invite links for student onboarding.
"""

import secrets
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import InviteStatus, SubjectArea, AssessmentType


def generate_invite_token():
    """Generate a secure random token for invite links."""
    return secrets.token_urlsafe(16)


class Invite(Base, TimestampMixin):
    """Assessment invite link for student onboarding.

    Tutors generate invite links with specific settings.
    Students use the link to take an assessment without needing an account.
    Results are linked to the tutor for review.
    """
    __tablename__ = "invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    token = Column(String(64), unique=True, nullable=False, index=True, default=generate_invite_token)

    # Tutor who created the invite
    tutor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Optional: link to student who used the invite
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Invite settings
    title = Column(String(200), nullable=True)
    assessment_type = Column(
        Enum(AssessmentType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=AssessmentType.INTAKE
    )
    subject_area = Column(Enum(SubjectArea), nullable=True)  # null = both
    question_count = Column(Integer, nullable=False, default=20)
    time_limit_minutes = Column(Integer, nullable=True)  # null = no limit
    is_adaptive = Column(Integer, nullable=False, default=1)  # Use CAT for question selection (1=True, 0=False)

    # Status tracking
    status = Column(Enum(InviteStatus), nullable=False, default=InviteStatus.ACTIVE)
    expires_at = Column(DateTime, nullable=True)  # null = never expires
    used_at = Column(DateTime, nullable=True)

    # Store guest info if student doesn't create account
    guest_name = Column(String(100), nullable=True)
    guest_email = Column(String(255), nullable=True)

    # Assessment result
    test_session_id = Column(UUID(as_uuid=True), ForeignKey("test_sessions.id", ondelete="SET NULL"), nullable=True)

    # Additional configuration
    config = Column(JSONB, nullable=True)

    # Relationships
    tutor = relationship("User", foreign_keys=[tutor_id], backref="invites_created")
    student = relationship("User", foreign_keys=[student_id], backref="invites_used")
    test_session = relationship("TestSession", backref="invite")

    def is_valid(self) -> bool:
        """Check if invite is still valid for use."""
        if self.status != InviteStatus.ACTIVE:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def mark_used(self, student_id: Optional[UUID] = None, guest_name: str = None, guest_email: str = None):
        """Mark invite as used."""
        self.status = InviteStatus.USED
        self.used_at = datetime.utcnow()
        if student_id:
            self.student_id = student_id
        if guest_name:
            self.guest_name = guest_name
        if guest_email:
            self.guest_email = guest_email
