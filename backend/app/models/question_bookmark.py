"""
SAT Tutoring Platform - Question Bookmark Model

A student's saved/starred questions in the Question Bank. One row per
(student, question). See
docs/superpowers/specs/2026-06-13-question-bank-redesign-design.md.
"""

import uuid

from sqlalchemy import Column, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.models.base import TimestampMixin


class QuestionBookmark(Base, TimestampMixin):
    """A question a student saved for later in the Question Bank."""

    __tablename__ = "question_bookmarks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("student_id", "question_id", name="uq_bookmark_student_question"),
        Index("ix_bookmark_student", "student_id"),
    )
