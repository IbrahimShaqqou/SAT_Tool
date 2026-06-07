"""
SAT Tutoring Platform - Study Plan Model

A coaching plan generated from an imported official Bluebook practice test.
One plan per imported attempt (test session). The plan is the authoritative
"what to do next" artifact shown to both the student and their tutor:
focus skills to learn + practice, the recommended next test, and per-skill
movement since the previous import.
"""

import uuid

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, relationship

from app.database import Base
from app.models.base import TimestampMixin


class StudyPlan(Base, TimestampMixin):
    """
    Import-driven study plan, one row per practice-test attempt.

    Attributes:
        student_id: Owner of the plan.
        test_session_id: The imported attempt this plan was built from (unique).
        test_number: Denormalized practice-test number for display/logic.
        focus_skills: Ordered ~6 weakest skills (each with accuracy + lesson_id).
        also_review: Remaining weak skills (<70%), same shape.
        recommended_next_test: Next test number to take (nullable).
        next_test_reason: Human note explaining the recommendation.
        deltas: Per-skill + score movement vs. the previous import (nullable).
    """

    __tablename__ = "study_plans"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Study plan UUID",
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student who owns this plan",
    )

    test_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="Imported attempt this plan was built from",
    )

    test_number = Column(
        Integer,
        nullable=True,
        comment="Practice-test number this plan is for",
    )

    focus_skills = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Ordered weakest skills to focus on (with accuracy + lesson_id)",
    )

    also_review = Column(
        JSONB,
        nullable=False,
        default=list,
        comment="Remaining weak skills worth reviewing",
    )

    recommended_next_test = Column(
        Integer,
        nullable=True,
        comment="Next practice-test number to take (null if none)",
    )

    next_test_reason = Column(
        Text,
        nullable=True,
        comment="Explanation for the next-test recommendation",
    )

    deltas = Column(
        JSONB,
        nullable=True,
        comment="Per-skill + score movement vs. the previous import",
    )

    # Relationship (no back_populates; TestSession doesn't need to know about plans)
    test_session: Mapped["object"] = relationship(  # noqa: F821
        "TestSession",
        viewonly=True,
    )
