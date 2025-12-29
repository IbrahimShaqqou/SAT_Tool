"""
SAT Tutoring Platform - Adaptive Learning Models

Models for IRT-based adaptive learning settings and tracking.
"""

from typing import TYPE_CHECKING
import uuid

from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, Index,
    Integer, String
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.taxonomy import Domain


class StudentAdaptiveSettings(Base, TimestampMixin):
    """
    Tutor-configurable adaptive learning settings per student.

    Controls question repetition windows, challenge bias, and other
    adaptive algorithm parameters.

    Attributes:
        student_id: Student these settings apply to

        # Repetition control (generous defaults for testing)
        repetition_time_days: Min days before repeating a question
        repetition_question_count: Min questions before repeating

        # Difficulty adjustment
        challenge_bias: How much to prefer harder questions (0.0-1.0)

        # Theta update behavior
        theta_update_weight: Multiplier for ability updates (0.5-2.0)
    """

    __tablename__ = "student_adaptive_settings"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Settings record UUID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="Student these settings apply to"
    )

    # Repetition window settings (GENEROUS DEFAULTS for testing)
    # Time-based: question available after X days
    repetition_time_days = Column(
        Integer,
        default=7,  # Generous: 1 week
        nullable=False,
        comment="Minimum days before question can repeat (default: 7)"
    )

    # Question-based: question available after X other questions answered
    repetition_question_count = Column(
        Integer,
        default=30,  # Generous: 30 questions
        nullable=False,
        comment="Minimum other questions before repeat (default: 30)"
    )

    # Challenge bias: 0.0 = no bias, 1.0 = strongly prefer harder questions
    challenge_bias = Column(
        Float,
        default=0.3,  # Moderate upward bias
        nullable=False,
        comment="Preference for harder questions (0.0-1.0, default: 0.3)"
    )

    # Theta update weight: how aggressively to update ability estimates
    # 1.0 = normal, >1.0 = more aggressive, <1.0 = more conservative
    theta_update_weight = Column(
        Float,
        default=1.0,  # Normal updates
        nullable=False,
        comment="Theta update aggressiveness (0.5-2.0, default: 1.0)"
    )

    # Relationships
    student: Mapped["User"] = relationship(
        "User",
        back_populates="adaptive_settings"
    )

    __table_args__ = (
        {"comment": "Tutor-configurable adaptive learning settings per student"}
    )


class StudentDomainAbility(Base, TimestampMixin):
    """
    Domain-level ability tracking (aggregated from skills).

    Each domain has its own theta estimate, computed from
    constituent skill abilities.
    """

    __tablename__ = "student_domain_abilities"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Record UUID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student ID"
    )

    domain_id = Column(
        Integer,
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Domain ID"
    )

    # Ability tracking
    ability_theta = Column(
        Float,
        default=0.0,
        nullable=False,
        comment="IRT ability estimate (theta). Range typically -3 to +3"
    )

    ability_se = Column(
        Float,
        default=1.0,
        nullable=False,
        comment="Standard error of ability estimate"
    )

    responses_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Total responses in this domain"
    )

    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="When ability was last updated"
    )

    # Relationships
    student: Mapped["User"] = relationship("User")
    domain: Mapped["Domain"] = relationship("Domain")

    __table_args__ = (
        Index(
            "uq_student_domain_ability",
            "student_id", "domain_id",
            unique=True
        ),
        {"comment": "Student ability levels per domain"}
    )


class StudentSectionAbility(Base, TimestampMixin):
    """
    Section-level ability tracking (Math or Reading/Writing).

    Highest level aggregation, used for SAT score prediction.
    """

    __tablename__ = "student_section_abilities"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Record UUID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student ID"
    )

    section = Column(
        String(20),
        nullable=False,
        comment="Section: 'math' or 'reading_writing'"
    )

    # Ability tracking
    ability_theta = Column(
        Float,
        default=0.0,
        nullable=False,
        comment="IRT ability estimate (theta). Range typically -3 to +3"
    )

    ability_se = Column(
        Float,
        default=1.0,
        nullable=False,
        comment="Standard error of ability estimate"
    )

    responses_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Total responses in this section"
    )

    # Predicted score range
    predicted_score_low = Column(
        Integer,
        nullable=True,
        comment="Lower bound of predicted section score (200-800)"
    )

    predicted_score_high = Column(
        Integer,
        nullable=True,
        comment="Upper bound of predicted section score (200-800)"
    )

    last_updated = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        comment="When ability was last updated"
    )

    # Relationships
    student: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index(
            "uq_student_section_ability",
            "student_id", "section",
            unique=True
        ),
        {"comment": "Student ability levels per SAT section"}
    )
