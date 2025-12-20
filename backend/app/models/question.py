"""
SAT Tutoring Platform - Question Models

Questions from College Board with versioning and related questions support.
"""

from typing import TYPE_CHECKING, List, Optional
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, VersionMixin
from app.models.enums import AnswerType, DifficultyLevel, SubjectArea

if TYPE_CHECKING:
    from app.models.taxonomy import Domain, Subdomain, Skill
    from app.models.response import StudentResponse


class Question(Base, TimestampMixin, SoftDeleteMixin, VersionMixin):
    """
    SAT practice question from College Board question bank.

    Stores questions fetched via fetch_math.py and fetch_reading.py
    with full metadata and taxonomy classification.

    Attributes:
        id: Internal primary key (UUID)
        external_id: College Board uId (unique identifier from CB)
        ibn: Item bank number from CB
        subject_area: math or reading_writing
        domain_id: Reference to domain
        skill_id: Reference to skill (granular classification)

        answer_type: MCQ or SPR
        difficulty: E/M/H from CB metadata
        score_band_range: CB score_band_range_cd

        prompt_html: Question text (HTML)
        choices_json: For MCQ - array of choice HTML strings
        correct_answer_json: MCQ: {"index": int}, SPR: {"answers": [...]}

        explanation_html: Detailed solution explanation

        IRT parameters (TODO: implement):
        - irt_difficulty_b: Item difficulty parameter
        - irt_discrimination_a: Item discrimination parameter

        Related questions and import tracking.
    """

    __tablename__ = "questions"

    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Internal question UUID"
    )

    # External identifiers (from College Board)
    external_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="College Board uId - unique question identifier"
    )

    ibn = Column(
        String(50),
        nullable=True,
        index=True,
        comment="Item bank number from CB metadata"
    )

    # Subject and taxonomy
    subject_area = Column(
        Enum(SubjectArea),
        nullable=False,
        index=True,
        comment="Subject: math or reading_writing"
    )

    domain_id = Column(
        Integer,
        ForeignKey("domains.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Domain classification"
    )

    subdomain_id = Column(
        Integer,
        ForeignKey("subdomains.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Subdomain classification (optional)"
    )

    skill_id = Column(
        Integer,
        ForeignKey("skills.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Skill classification (most granular)"
    )

    # Question type and difficulty
    answer_type = Column(
        Enum(AnswerType),
        nullable=False,
        index=True,
        comment="Answer type: MCQ or SPR"
    )

    difficulty = Column(
        Enum(DifficultyLevel),
        nullable=True,
        index=True,
        comment="Difficulty level: E (Easy), M (Medium), H (Hard)"
    )

    score_band_range = Column(
        String(20),
        nullable=True,
        comment="CB score_band_range_cd for difficulty calibration"
    )

    # Question content
    prompt_html = Column(
        Text,
        nullable=False,
        comment="Question text in HTML format"
    )

    # MCQ choices stored as JSON array of HTML strings
    choices_json = Column(
        JSONB,
        nullable=True,
        comment="MCQ choices as JSON array of HTML strings"
    )

    # Correct answer: {"index": int} for MCQ, {"answers": [...]} for SPR
    correct_answer_json = Column(
        JSONB,
        nullable=False,
        comment="Correct answer: MCQ={index:int}, SPR={answers:[str,...]}"
    )

    # Explanation
    explanation_html = Column(
        Text,
        nullable=True,
        comment="Detailed solution explanation in HTML"
    )

    # =========================================================================
    # IRT Parameters - TODO: Implement IRT calibration
    # These fields are ready for Item Response Theory parameters
    # to be populated via calibration process
    # =========================================================================

    # TODO: Implement IRT calibration process to populate these values
    irt_difficulty_b = Column(
        Float,
        nullable=True,
        comment="TODO: IRT difficulty parameter (b). Range typically -3 to +3"
    )

    # TODO: Implement IRT calibration process to populate these values
    irt_discrimination_a = Column(
        Float,
        nullable=True,
        comment="TODO: IRT discrimination parameter (a). Range typically 0.5 to 2.5"
    )

    # TODO: Implement IRT calibration process to populate these values
    irt_guessing_c = Column(
        Float,
        nullable=True,
        default=0.25,  # Default for 4-choice MCQ
        comment="TODO: IRT guessing parameter (c). Default 0.25 for 4-choice MCQ"
    )

    # =========================================================================
    # End IRT Parameters
    # =========================================================================

    # Import and status tracking
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether question is active for use"
    )

    is_verified = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether question has been manually verified"
    )

    # Raw import data preserved for debugging
    raw_import_json = Column(
        JSONB,
        nullable=True,
        comment="Original CB API response for debugging"
    )

    import_batch_id = Column(
        String(50),
        nullable=True,
        index=True,
        comment="Batch identifier for bulk imports"
    )

    imported_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When question was imported"
    )

    # Relationships
    domain: Mapped[Optional["Domain"]] = relationship(
        "Domain",
        back_populates="questions"
    )

    subdomain: Mapped[Optional["Subdomain"]] = relationship(
        "Subdomain"
    )

    skill: Mapped[Optional["Skill"]] = relationship(
        "Skill",
        back_populates="questions"
    )

    responses: Mapped[List["StudentResponse"]] = relationship(
        "StudentResponse",
        back_populates="question"
    )

    versions: Mapped[List["QuestionVersion"]] = relationship(
        "QuestionVersion",
        back_populates="question",
        order_by="QuestionVersion.version_number.desc()"
    )

    # Self-referential many-to-many for related questions
    related_questions: Mapped[List["Question"]] = relationship(
        "Question",
        secondary="question_relations",
        primaryjoin="Question.id == QuestionRelation.question_id",
        secondaryjoin="Question.id == QuestionRelation.related_question_id",
        backref="related_to"
    )

    __table_args__ = (
        # Composite indexes for common query patterns
        Index("ix_questions_domain_difficulty", "domain_id", "difficulty"),
        Index("ix_questions_skill_difficulty", "skill_id", "difficulty"),
        Index("ix_questions_subject_active", "subject_area", "is_active"),
        Index("ix_questions_type_difficulty", "answer_type", "difficulty"),

        {"comment": "SAT questions from College Board question bank"}
    )


class QuestionVersion(Base, TimestampMixin):
    """
    Question version history for tracking changes.

    Stores snapshots of question content when changes are made,
    enabling audit trails and rollback capability.

    Attributes:
        id: Primary key
        question_id: Parent question reference
        version_number: Sequential version number
        change_reason: Why the change was made
        content_snapshot: Full question content at this version
        changed_by_id: User who made the change
    """

    __tablename__ = "question_versions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Version record UUID"
    )

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent question ID"
    )

    version_number = Column(
        Integer,
        nullable=False,
        comment="Sequential version number"
    )

    change_reason = Column(
        String(500),
        nullable=True,
        comment="Reason for this version change"
    )

    # Snapshot of all content fields at this version
    content_snapshot = Column(
        JSONB,
        nullable=False,
        comment="Full question content snapshot"
    )

    changed_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who made this change"
    )

    # Relationships
    question: Mapped["Question"] = relationship(
        "Question",
        back_populates="versions"
    )

    __table_args__ = (
        UniqueConstraint(
            "question_id", "version_number",
            name="uq_question_version_number"
        ),
        {"comment": "Question version history for audit trail"}
    )


class QuestionRelation(Base, TimestampMixin):
    """
    Many-to-many relationship for related questions.

    Links questions that are similar, test the same concept,
    or should be shown together for practice.

    Attributes:
        question_id: Source question
        related_question_id: Related question
        relation_type: Type of relationship (similar, prerequisite, etc.)
        similarity_score: Computed similarity (0-1)
    """

    __tablename__ = "question_relations"

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        primary_key=True,
        comment="Source question ID"
    )

    related_question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        primary_key=True,
        comment="Related question ID"
    )

    relation_type = Column(
        String(50),
        default="similar",
        nullable=False,
        comment="Relationship type: similar, prerequisite, follow_up"
    )

    similarity_score = Column(
        Float,
        nullable=True,
        comment="Computed similarity score (0-1)"
    )

    __table_args__ = (
        CheckConstraint(
            "question_id != related_question_id",
            name="ck_question_relations_not_self"
        ),
        {"comment": "Related questions mapping"}
    )
