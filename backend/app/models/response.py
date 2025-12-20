"""
SAT Tutoring Platform - Student Response and Skill Mastery Models

Tracks student answers and computes skill-level mastery.
"""

from typing import TYPE_CHECKING, Optional
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Index,
    Integer, Text
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.question import Question
    from app.models.taxonomy import Skill
    from app.models.test import TestSession


class StudentResponse(Base, TimestampMixin):
    """
    Individual student response to a question.

    Captures the student's answer, correctness, time spent,
    and context (which test session, if any).

    Attributes:
        id: Primary key
        student_id: Student who answered
        question_id: Question that was answered
        test_session_id: Test session context (optional)

        response_json: Student's answer (same format as correct_answer_json)
        is_correct: Whether response was correct
        time_spent_seconds: Time spent on question

        confidence_level: Self-reported confidence (1-5)
        flagged_for_review: Student flagged for later review
    """

    __tablename__ = "student_responses"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Response record UUID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student who submitted response"
    )

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Question that was answered"
    )

    test_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("test_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Test session context (if applicable)"
    )

    # Response data
    response_json = Column(
        JSONB,
        nullable=False,
        comment="Student response: MCQ={index:int}, SPR={answer:str}"
    )

    is_correct = Column(
        Boolean,
        nullable=False,
        index=True,
        comment="Whether response was correct"
    )

    # Timing
    time_spent_seconds = Column(
        Integer,
        nullable=True,
        comment="Time spent on question in seconds"
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When student started the question"
    )

    submitted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="When response was submitted"
    )

    # Student feedback
    confidence_level = Column(
        Integer,
        nullable=True,
        comment="Self-reported confidence (1-5 scale)"
    )

    flagged_for_review = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Student flagged for later review"
    )

    # Notes
    student_notes = Column(
        Text,
        nullable=True,
        comment="Student's notes on this question"
    )

    # =========================================================================
    # IRT Ability Estimation Fields - TODO: Implement
    # These fields support ability estimation after each response
    # =========================================================================

    # TODO: Implement IRT ability estimation to populate these values
    ability_estimate_before = Column(
        Float,
        nullable=True,
        comment="TODO: Student ability estimate before this response"
    )

    # TODO: Implement IRT ability estimation to populate these values
    ability_estimate_after = Column(
        Float,
        nullable=True,
        comment="TODO: Student ability estimate after this response"
    )

    # =========================================================================
    # End IRT Fields
    # =========================================================================

    # Relationships
    student: Mapped["User"] = relationship(
        "User",
        back_populates="responses"
    )

    question: Mapped["Question"] = relationship(
        "Question",
        back_populates="responses"
    )

    test_session: Mapped[Optional["TestSession"]] = relationship(
        "TestSession",
        back_populates="responses"
    )

    __table_args__ = (
        # Composite indexes for common queries
        Index("ix_responses_student_question", "student_id", "question_id"),
        Index("ix_responses_student_correct", "student_id", "is_correct"),
        Index("ix_responses_session_order", "test_session_id", "submitted_at"),
        Index("ix_responses_student_submitted", "student_id", "submitted_at"),

        {"comment": "Student responses to questions"}
    )


class StudentSkill(Base, TimestampMixin):
    """
    Student mastery level for a specific skill.

    Tracks computed mastery based on response history,
    supporting IRT-based ability estimation.

    Attributes:
        id: Primary key
        student_id: Student
        skill_id: Skill being tracked

        mastery_level: Current mastery (0-100 scale)
        questions_attempted: Total questions attempted
        questions_correct: Total correct answers

        IRT fields (TODO):
        - ability_theta: Estimated ability parameter
        - ability_se: Standard error of estimate
    """

    __tablename__ = "student_skills"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Student skill record UUID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student ID"
    )

    skill_id = Column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Skill ID"
    )

    # Basic mastery metrics
    mastery_level = Column(
        Float,
        default=0.0,
        nullable=False,
        comment="Current mastery level (0-100 scale)"
    )

    questions_attempted = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Total questions attempted for this skill"
    )

    questions_correct = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Total correct answers for this skill"
    )

    last_practiced_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When skill was last practiced"
    )

    # =========================================================================
    # IRT Ability Estimation - TODO: Implement
    # These fields support IRT-based ability tracking per skill
    # =========================================================================

    # TODO: Implement IRT ability estimation to populate this value
    ability_theta = Column(
        Float,
        nullable=True,
        default=0.0,
        comment="TODO: IRT ability estimate (theta). Range typically -3 to +3"
    )

    # TODO: Implement IRT ability estimation to populate this value
    ability_se = Column(
        Float,
        nullable=True,
        comment="TODO: Standard error of ability estimate"
    )

    # TODO: Implement IRT ability estimation to populate this value
    responses_for_estimate = Column(
        Integer,
        default=0,
        nullable=False,
        comment="TODO: Number of responses used in current estimate"
    )

    # =========================================================================
    # End IRT Fields
    # =========================================================================

    # Relationships
    student: Mapped["User"] = relationship(
        "User",
        back_populates="skill_masteries"
    )

    skill: Mapped["Skill"] = relationship(
        "Skill"
    )

    __table_args__ = (
        # Unique constraint: one record per student-skill pair
        Index(
            "uq_student_skill",
            "student_id", "skill_id",
            unique=True
        ),
        Index("ix_student_skills_mastery", "student_id", "mastery_level"),

        {"comment": "Student mastery levels per skill"}
    )
