"""
SAT Tutoring Platform - Test Session Models

Test sessions for practice tests, diagnostics, and assigned tests.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Index,
    Integer, String
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import TestType, TestStatus, SubjectArea

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.question import Question
    from app.models.response import StudentResponse
    from app.models.assignment import Assignment


class TestSession(Base, TimestampMixin):
    """
    A test-taking session (practice test, diagnostic, or assigned).

    Represents a complete test attempt with timing, scoring,
    and question selection configuration.

    Attributes:
        id: Primary key
        student_id: Student taking the test
        assignment_id: If from an assignment

        test_type: practice, assigned, diagnostic, full_length
        status: not_started, in_progress, completed, etc.
        subject_area: math or reading_writing (or both for full_length)

        Timing and scoring fields.
        Configuration for question selection.
    """

    __tablename__ = "test_sessions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Test session UUID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student taking the test"
    )

    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Parent assignment (if assigned test)"
    )

    # Test configuration
    test_type = Column(
        Enum(TestType),
        nullable=False,
        index=True,
        comment="Type: practice, assigned, diagnostic, full_length"
    )

    status = Column(
        Enum(TestStatus),
        default=TestStatus.NOT_STARTED,
        nullable=False,
        index=True,
        comment="Current status of the test"
    )

    subject_area = Column(
        Enum(SubjectArea),
        nullable=True,
        comment="Subject focus (null for full_length covering both)"
    )

    title = Column(
        String(200),
        nullable=True,
        comment="Optional test title"
    )

    # Question configuration
    total_questions = Column(
        Integer,
        nullable=True,
        comment="Total number of questions in test (null for unlimited)"
    )

    question_config = Column(
        JSONB,
        nullable=True,
        comment="Question selection config (domains, difficulties, etc.)"
    )

    # Timing
    time_limit_minutes = Column(
        Integer,
        nullable=True,
        comment="Time limit in minutes (null for untimed)"
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When test was started"
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When test was completed"
    )

    time_spent_seconds = Column(
        Integer,
        nullable=True,
        comment="Total time spent in seconds"
    )

    # Scoring
    questions_answered = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of questions answered"
    )

    questions_correct = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of correct answers"
    )

    score_percentage = Column(
        Float,
        nullable=True,
        comment="Score as percentage (0-100)"
    )

    scaled_score = Column(
        Integer,
        nullable=True,
        comment="SAT scaled score (200-800 per section)"
    )

    # Session state for resume capability
    current_question_index = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Current position in test (0-indexed)"
    )

    session_state = Column(
        JSONB,
        nullable=True,
        comment="Session state for resuming (flagged questions, etc.)"
    )

    # Relationships
    student: Mapped["User"] = relationship(
        "User",
        back_populates="test_sessions"
    )

    assignment: Mapped[Optional["Assignment"]] = relationship(
        "Assignment",
        back_populates="test_sessions"
    )

    responses: Mapped[List["StudentResponse"]] = relationship(
        "StudentResponse",
        back_populates="test_session",
        order_by="StudentResponse.submitted_at"
    )

    questions: Mapped[List["TestQuestion"]] = relationship(
        "TestQuestion",
        back_populates="test_session",
        order_by="TestQuestion.question_order"
    )

    __table_args__ = (
        Index("ix_test_sessions_student_status", "student_id", "status"),
        Index("ix_test_sessions_student_type", "student_id", "test_type"),
        Index("ix_test_sessions_assignment", "assignment_id"),

        {"comment": "Test-taking sessions"}
    )


class TestQuestion(Base, TimestampMixin):
    """
    Questions assigned to a specific test session.

    Links questions to test sessions with ordering
    and per-question metadata.

    Attributes:
        id: Primary key
        test_session_id: Parent test session
        question_id: Question reference
        question_order: Position in test (1-indexed)
        is_answered: Whether student has answered
        is_flagged: Whether student flagged for review
    """

    __tablename__ = "test_questions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Test question link UUID"
    )

    test_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent test session"
    )

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Question reference"
    )

    question_order = Column(
        Integer,
        nullable=False,
        comment="Position in test (1-indexed)"
    )

    is_answered = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether student has answered"
    )

    is_flagged = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether student flagged for review"
    )

    # Relationships
    test_session: Mapped["TestSession"] = relationship(
        "TestSession",
        back_populates="questions"
    )

    question: Mapped["Question"] = relationship(
        "Question"
    )

    __table_args__ = (
        Index(
            "uq_test_question_order",
            "test_session_id", "question_order",
            unique=True
        ),
        Index(
            "uq_test_question_unique",
            "test_session_id", "question_id",
            unique=True
        ),

        {"comment": "Questions assigned to test sessions"}
    )
