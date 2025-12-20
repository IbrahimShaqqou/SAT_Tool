"""
SAT Tutoring Platform - Assignment Models

Tutor-assigned practice sessions and homework.
"""

from typing import TYPE_CHECKING, List
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index,
    Integer, String, Text
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AssignmentStatus

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.question import Question
    from app.models.test import TestSession


class Assignment(Base, TimestampMixin):
    """
    Tutor-assigned practice session.

    Tutors can assign specific questions or generate
    dynamic tests based on skills the student needs to practice.

    Attributes:
        id: Primary key
        tutor_id: Tutor who created assignment
        student_id: Student assigned to

        title: Assignment title
        instructions: Tutor instructions

        due_date: When assignment is due
        status: pending, in_progress, completed, overdue

        Configuration for question selection or specific questions.
    """

    __tablename__ = "assignments"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Assignment UUID"
    )

    tutor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tutor who created assignment"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student assigned to"
    )

    # Assignment details
    title = Column(
        String(200),
        nullable=False,
        comment="Assignment title"
    )

    instructions = Column(
        Text,
        nullable=True,
        comment="Tutor instructions for student"
    )

    # Status and timing
    status = Column(
        Enum(AssignmentStatus),
        default=AssignmentStatus.PENDING,
        nullable=False,
        index=True,
        comment="Current status"
    )

    due_date = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="When assignment is due"
    )

    assigned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        comment="When assignment was created"
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When student started"
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When student completed"
    )

    # Configuration
    question_count = Column(
        Integer,
        nullable=True,
        comment="Number of questions (for dynamic selection)"
    )

    question_config = Column(
        JSONB,
        nullable=True,
        comment="Config for dynamic question selection"
    )

    time_limit_minutes = Column(
        Integer,
        nullable=True,
        comment="Time limit in minutes (null for untimed)"
    )

    # Scoring
    target_score = Column(
        Integer,
        nullable=True,
        comment="Target score percentage for passing"
    )

    actual_score = Column(
        Integer,
        nullable=True,
        comment="Student's actual score percentage"
    )

    # Tutor feedback
    tutor_feedback = Column(
        Text,
        nullable=True,
        comment="Tutor feedback after completion"
    )

    # Relationships
    tutor: Mapped["User"] = relationship(
        "User",
        foreign_keys=[tutor_id],
        back_populates="assignments_given"
    )

    student: Mapped["User"] = relationship(
        "User",
        foreign_keys=[student_id],
        back_populates="assignments_received"
    )

    questions: Mapped[List["AssignmentQuestion"]] = relationship(
        "AssignmentQuestion",
        back_populates="assignment",
        order_by="AssignmentQuestion.question_order"
    )

    test_sessions: Mapped[List["TestSession"]] = relationship(
        "TestSession",
        back_populates="assignment"
    )

    __table_args__ = (
        Index("ix_assignments_student_status", "student_id", "status"),
        Index("ix_assignments_tutor_status", "tutor_id", "status"),
        Index("ix_assignments_due_date", "due_date", "status"),

        {"comment": "Tutor-assigned practice sessions"}
    )


class AssignmentQuestion(Base, TimestampMixin):
    """
    Specific questions assigned in an assignment.

    For assignments with pre-selected questions rather than
    dynamic question generation.

    Attributes:
        id: Primary key
        assignment_id: Parent assignment
        question_id: Specific question assigned
        question_order: Order in assignment
        is_required: Whether question is required
    """

    __tablename__ = "assignment_questions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Assignment question link UUID"
    )

    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent assignment"
    )

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Assigned question"
    )

    question_order = Column(
        Integer,
        nullable=False,
        comment="Order in assignment (1-indexed)"
    )

    is_required = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether question is required"
    )

    # Relationships
    assignment: Mapped["Assignment"] = relationship(
        "Assignment",
        back_populates="questions"
    )

    question: Mapped["Question"] = relationship(
        "Question"
    )

    __table_args__ = (
        Index(
            "uq_assignment_question_order",
            "assignment_id", "question_order",
            unique=True
        ),
        Index(
            "uq_assignment_question_unique",
            "assignment_id", "question_id",
            unique=True
        ),

        {"comment": "Questions in assignments"}
    )
