"""
SAT Tutoring Platform - User Model

User accounts for students, tutors, and administrators.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, String
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.response import StudentResponse, StudentSkill
    from app.models.test import TestSession
    from app.models.assignment import Assignment
    from app.models.adaptive import StudentAdaptiveSettings


class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    User account model supporting students, tutors, and admins.

    Attributes:
        id: Primary key UUID
        email: Unique email address (login identifier)
        password_hash: Bcrypt hashed password
        role: User role (student/tutor/admin)
        first_name: User's first name
        last_name: User's last name
        is_active: Whether account is active
        is_verified: Email verification status
        last_login_at: Most recent login timestamp
        profile_data: JSONB for role-specific profile data
        tutor_id: For students, their assigned tutor
    """

    __tablename__ = "users"

    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique user identifier"
    )

    # Authentication
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
        comment="User email address (login identifier)"
    )
    password_hash = Column(
        String(255),
        nullable=False,
        comment="Bcrypt hashed password"
    )

    # Role and status
    role = Column(
        Enum(UserRole),
        nullable=False,
        default=UserRole.STUDENT,
        index=True,
        comment="User role: student, tutor, or admin"
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether account is active"
    )
    is_verified = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Email verification status"
    )

    # Profile
    first_name = Column(
        String(100),
        nullable=False,
        comment="User's first name"
    )
    last_name = Column(
        String(100),
        nullable=False,
        comment="User's last name"
    )

    # Timestamps
    last_login_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Most recent login timestamp"
    )

    # Extended profile data (JSONB for flexibility)
    profile_data = Column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Role-specific profile data (grade level, subjects, etc.)"
    )

    # Student-tutor relationship
    tutor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="For students: assigned tutor ID"
    )

    # Relationships
    tutor: Mapped[Optional["User"]] = relationship(
        "User",
        remote_side=[id],
        backref="students",
        foreign_keys=[tutor_id]
    )

    responses: Mapped[List["StudentResponse"]] = relationship(
        "StudentResponse",
        back_populates="student",
        foreign_keys="StudentResponse.student_id"
    )

    skill_masteries: Mapped[List["StudentSkill"]] = relationship(
        "StudentSkill",
        back_populates="student"
    )

    test_sessions: Mapped[List["TestSession"]] = relationship(
        "TestSession",
        back_populates="student",
        foreign_keys="TestSession.student_id"
    )

    # Assignments where user is the student
    assignments_received: Mapped[List["Assignment"]] = relationship(
        "Assignment",
        back_populates="student",
        foreign_keys="Assignment.student_id"
    )

    # Assignments where user is the tutor
    assignments_given: Mapped[List["Assignment"]] = relationship(
        "Assignment",
        back_populates="tutor",
        foreign_keys="Assignment.tutor_id"
    )

    # Adaptive learning settings
    adaptive_settings: Mapped[Optional["StudentAdaptiveSettings"]] = relationship(
        "StudentAdaptiveSettings",
        back_populates="student",
        uselist=False  # One-to-one relationship
    )

    # Indexes
    __table_args__ = (
        Index("ix_users_role_active", "role", "is_active"),
        Index("ix_users_tutor_active", "tutor_id", "is_active"),
        {"comment": "User accounts for students, tutors, and administrators"}
    )

    @property
    def full_name(self) -> str:
        """Return user's full name."""
        return f"{self.first_name} {self.last_name}"
