"""
SAT Tutoring Platform - Test Module Models

Bluebook-style modular test structure for full-length SAT tests.
Each full-length test consists of 4 modules (2 Math, 2 Reading/Writing).
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SQLEnum, Float, ForeignKey,
    Index, Integer, String
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import SubjectArea, TestStatus

if TYPE_CHECKING:
    from app.models.test import TestSession
    from app.models.question import Question
    from app.models.response import StudentResponse


# Bluebook SAT Format Configuration
BLUEBOOK_SAT_FORMAT = {
    "Math": {
        "Module_1": {"questions": 22, "time_minutes": 35},
        "Module_2": {"questions": 22, "time_minutes": 35}
    },
    "Reading_Writing": {
        "Module_1": {"questions": 27, "time_minutes": 32},
        "Module_2": {"questions": 27, "time_minutes": 32}
    },
    "total_questions": 98,
    "total_time_minutes": 134,  # 2 hours 14 minutes
    "break_minutes": 10  # Break between Math and Reading/Writing sections
}


class TestModule(Base, TimestampMixin):
    """
    A single module within a full-length SAT test.

    Bluebook SAT structure:
    - Module 1: Math (22 questions, 35 minutes)
    - Module 2: Math (22 questions, 35 minutes)
    - [10-minute break]
    - Module 3: Reading/Writing (27 questions, 32 minutes)
    - Module 4: Reading/Writing (27 questions, 32 minutes)

    Students cannot navigate back to previous modules once submitted.
    """

    __tablename__ = "test_modules"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Module UUID"
    )

    test_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent test session"
    )

    # Module configuration
    module_number = Column(
        Integer,
        nullable=False,
        comment="Module sequence: 1, 2, 3, 4"
    )

    subject_area = Column(
        SQLEnum(SubjectArea),
        nullable=False,
        comment="MATH or READING_WRITING"
    )

    title = Column(
        String(100),
        nullable=False,
        comment="Display name: 'Math Module 1'"
    )

    # Module specifications
    total_questions = Column(
        Integer,
        nullable=False,
        comment="Number of questions in module (22 for Math, 27 for R/W)"
    )

    time_limit_minutes = Column(
        Integer,
        nullable=False,
        comment="Time limit for module (35 for Math, 32 for R/W)"
    )

    # Status tracking
    status = Column(
        SQLEnum(TestStatus),
        default=TestStatus.NOT_STARTED,
        nullable=False,
        index=True,
        comment="Module status"
    )

    # Timing
    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When module was started"
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When module was submitted"
    )

    time_spent_seconds = Column(
        Integer,
        nullable=True,
        comment="Actual time spent on module"
    )

    time_expired = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether module auto-submitted due to time limit"
    )

    # Scoring
    questions_answered = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Questions answered in module"
    )

    questions_correct = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Correct answers in module"
    )

    score_percentage = Column(
        Float,
        nullable=True,
        comment="Module score percentage"
    )

    # Navigation state
    current_question_index = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Current question within module (0-indexed)"
    )

    # Question IDs for this module
    question_ids = Column(
        JSONB,
        nullable=False,
        comment="Array of question UUIDs for this module"
    )

    # Module state
    flagged_question_indices = Column(
        JSONB,
        default=list,
        nullable=False,
        comment="Indices of questions flagged for review"
    )

    # Relationships
    test_session: Mapped["TestSession"] = relationship(
        "TestSession",
        back_populates="modules"
    )

    # Indexes
    __table_args__ = (
        Index("idx_test_module_session_number", "test_session_id", "module_number"),
        Index("idx_test_module_status", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<TestModule {self.title} "
            f"({self.questions_answered}/{self.total_questions} answered, "
            f"status={self.status.value})>"
        )


class ModuleBreak(Base, TimestampMixin):
    """
    Tracks breaks between modules (e.g., 10-minute break between sections).
    """

    __tablename__ = "module_breaks"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    test_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("test_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Which modules this break is between
    after_module_number = Column(
        Integer,
        nullable=False,
        comment="Break after completing this module"
    )

    before_module_number = Column(
        Integer,
        nullable=False,
        comment="Break before starting this module"
    )

    # Break timing
    break_duration_minutes = Column(
        Integer,
        nullable=False,
        comment="Scheduled break duration"
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When break started"
    )

    ended_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When break ended (student proceeded)"
    )

    skipped = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether student skipped the break"
    )

    # Relationship
    test_session: Mapped["TestSession"] = relationship(
        "TestSession",
        back_populates="breaks"
    )
