"""
SAT Tutoring Platform - QuestionExplanation Model

Stores AI-generated step-by-step explanations for questions.
"""

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Column, DateTime, String, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.question import Question


class QuestionExplanation(Base):
    """
    AI-generated step-by-step explanation for a question.

    Attributes:
        id: Primary key (UUID)
        question_id: FK to questions.id (unique — one explanation per question)
        explanation_type: 'math', 'reading', or 'grammar'
        steps_json: Full explanation JSON (steps, key_insight, why_wrong, optional desmos/highlights)
        model_used: Claude model that generated this
        is_approved: Manual approval flag for quality control
        generated_at: When Claude generated this
        created_at / updated_at: Record timestamps
    """

    __tablename__ = "question_explanations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Explanation record UUID",
    )

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
        comment="Parent question ID",
    )

    explanation_type = Column(
        String(20),
        nullable=False,
        comment="Type: math, reading, or grammar",
    )

    steps_json = Column(
        JSONB,
        nullable=False,
        comment="Full explanation JSON",
    )

    model_used = Column(
        String(100),
        nullable=False,
        comment="Claude model that generated this explanation",
    )

    is_approved = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Whether a human has approved this explanation",
    )

    generated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="When Claude generated this",
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationship back to question
    question: Mapped["Question"] = relationship(
        "Question",
        back_populates="explanation",
    )

    __table_args__ = (
        CheckConstraint(
            "explanation_type IN ('math', 'reading', 'grammar')",
            name="ck_qe_explanation_type",
        ),
        {"comment": "AI-generated step-by-step question explanations"},
    )
