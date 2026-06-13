"""
SAT Tutoring Platform - Worklist Models

The live, ordered "what to work on between practice tests" list and the
mastery-check attempts that gate each skill.

- WorklistItem: one row per skill a student is actively working. Generated from
  a practice test's weak skills (and addable by a tutor). Mutable: status,
  order, before/after scores, tutor locks.
- MasteryCheck: one attempt at a fixed-difficulty-spread check (1 easy / 2
  medium / 2 hard) that proves whether a skill is mastered.

See docs/superpowers/specs/2026-06-13-score-raising-loop-design.md.
"""

import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, Enum,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import WorklistStatus, MasteryCheckKind


class WorklistItem(Base, TimestampMixin):
    """One skill on a student's live worklist."""

    __tablename__ = "worklist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Student who owns this item",
    )
    skill_id = Column(
        Integer,
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The skill being worked",
    )
    source_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("test_sessions.id", ondelete="SET NULL"),
        nullable=True,
        comment="Imported test that spawned this item (null = tutor-added)",
    )

    status = Column(
        Enum(WorklistStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=WorklistStatus.OPEN,
        index=True,
        comment="Lifecycle status",
    )
    position = Column(
        Integer,
        nullable=False,
        default=0,
        comment="Order in the list (tutor-reorderable)",
    )

    baseline_accuracy = Column(
        Float,
        nullable=True,
        comment="Skill % on the source test (rough 'why flagged' indicator)",
    )
    # Soft reference (no DB FK) to avoid a circular constraint with
    # mastery_checks.worklist_item_id. Resolved in code when needed.
    baseline_check_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="Authoritative 'before' MasteryCheck id, if the student took one",
    )
    current_accuracy = Column(
        Float,
        nullable=True,
        comment="Latest measured % ('after')",
    )

    source = Column(
        Enum("auto", "tutor", name="worklistsource"),
        nullable=False,
        default="auto",
        comment="How the item got here",
    )
    tutor_locked = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Tutor pinned this item; auto-gen won't remove it",
    )
    lesson_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        comment="Cached lesson link for this skill, if any",
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the item reached done (TimestampMixin gives created/updated)",
    )

    __table_args__ = (
        UniqueConstraint("student_id", "skill_id", name="uq_worklist_student_skill"),
        Index("ix_worklist_student_status", "student_id", "status"),
    )

    checks: Mapped[list] = relationship(
        "MasteryCheck",
        back_populates="worklist_item",
        foreign_keys="MasteryCheck.worklist_item_id",
        cascade="all, delete-orphan",
    )


class MasteryCheck(Base, TimestampMixin):
    """One attempt at a mastery (or baseline/refresh) check for a worklist item."""

    __tablename__ = "mastery_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    worklist_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("worklist_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    kind = Column(
        Enum(MasteryCheckKind, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=MasteryCheckKind.MASTERY,
    )

    question_ids = Column(
        JSONB, nullable=False, default=list,
        comment="Ordered question IDs served (the 5: 1E/2M/2H)",
    )
    responses = Column(
        JSONB, nullable=True,
        comment="Per-question: question_id, band, chosen, correct",
    )
    score = Column(Integer, nullable=True, comment="# correct (0-5)")
    hard_correct = Column(Integer, nullable=True, comment="# hard correct (0-2)")
    passed = Column(Boolean, nullable=True, comment="score>=4 AND hard_correct>=1")
    attempt_number = Column(
        Integer, nullable=False, default=1,
        comment="Mastery retry tracking (cap 2)",
    )

    worklist_item = relationship(
        "WorklistItem",
        back_populates="checks",
        foreign_keys=[worklist_item_id],
    )
