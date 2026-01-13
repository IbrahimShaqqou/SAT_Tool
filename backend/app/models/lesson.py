"""
ZooPrep - Lesson Models

Educational content linked to skills to help students learn concepts.
"""

from typing import TYPE_CHECKING, List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, Enum as SQLEnum, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import SubjectArea

if TYPE_CHECKING:
    from app.models.taxonomy import Skill, Domain


class LessonStatus:
    """Lesson status constants"""
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"  # Content being developed


class Lesson(Base, TimestampMixin):
    """
    Educational lesson content linked to a skill.

    Each skill can have one lesson that teaches the concept.
    Lessons contain rich content with sections, examples, and visuals.

    Attributes:
        id: Primary key UUID
        skill_id: Linked skill
        title: Lesson title
        subtitle: Short description
        status: draft, published, or in_progress
        content_json: Structured lesson content
        estimated_minutes: Estimated time to complete
        display_order: For ordering within domain
    """

    __tablename__ = "lessons"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        comment="Lesson primary key"
    )

    skill_id = Column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One lesson per skill
        index=True,
        comment="Linked skill ID"
    )

    domain_id = Column(
        Integer,
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Parent domain ID for quick filtering"
    )

    title = Column(
        String(200),
        nullable=False,
        comment="Lesson title"
    )

    subtitle = Column(
        String(500),
        nullable=True,
        comment="Short description or tagline"
    )

    status = Column(
        String(20),
        default=LessonStatus.DRAFT,
        nullable=False,
        index=True,
        comment="Lesson status: draft, published, in_progress"
    )

    # Structured content as JSON for flexibility
    # Format: { "sections": [...], "keyTakeaways": [...], "practiceProblems": [...] }
    content_json = Column(
        JSONB,
        nullable=True,
        default=dict,
        comment="Structured lesson content"
    )

    # Lesson metadata
    estimated_minutes = Column(
        Integer,
        default=10,
        nullable=False,
        comment="Estimated time to complete in minutes"
    )

    difficulty_level = Column(
        String(20),
        default="intermediate",
        nullable=False,
        comment="Lesson difficulty: beginner, intermediate, advanced"
    )

    # Visual customization
    icon = Column(
        String(50),
        nullable=True,
        comment="Icon name for display (Lucide icon name)"
    )

    color = Column(
        String(20),
        nullable=True,
        comment="Accent color for lesson card (e.g., blue, green, purple)"
    )

    # Cover image or illustration
    cover_image_url = Column(
        String(500),
        nullable=True,
        comment="URL to cover image or illustration"
    )

    display_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order within domain"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether lesson is active"
    )

    # Relationships
    skill: Mapped["Skill"] = relationship(
        "Skill",
        backref="lesson"
    )

    domain: Mapped[Optional["Domain"]] = relationship(
        "Domain",
        backref="lessons"
    )

    completions: Mapped[List["LessonCompletion"]] = relationship(
        "LessonCompletion",
        back_populates="lesson",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_lessons_domain_status", "domain_id", "status"),
        Index("ix_lessons_status_active", "status", "is_active"),
        {"comment": "Educational lessons linked to skills"}
    )


class LessonCompletion(Base, TimestampMixin):
    """
    Tracks student lesson completion.

    Attributes:
        id: Primary key
        lesson_id: Completed lesson
        student_id: Student who completed
        completed_at: Completion timestamp
        time_spent_seconds: Actual time spent
    """

    __tablename__ = "lesson_completions"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Completion record primary key"
    )

    lesson_id = Column(
        UUID(as_uuid=True),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Completed lesson ID"
    )

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student who completed"
    )

    time_spent_seconds = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Actual time spent in seconds"
    )

    # Optional progress tracking
    progress_percent = Column(
        Integer,
        default=100,
        nullable=False,
        comment="Completion percentage (0-100)"
    )

    # Relationships
    lesson: Mapped["Lesson"] = relationship(
        "Lesson",
        back_populates="completions"
    )

    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id", name="uq_lesson_student"),
        Index("ix_lesson_completions_student", "student_id"),
        {"comment": "Student lesson completion tracking"}
    )
