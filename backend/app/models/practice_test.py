"""
SAT Tutoring Platform - Practice Test Models

Models for official College Board practice tests and their mappings.
"""

from typing import TYPE_CHECKING, List, Optional, Dict, Any
import uuid

from sqlalchemy import (
    Column, DateTime, Integer, String, Text, ForeignKey, Index, Boolean
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.question import Question


class PracticeTest(Base, TimestampMixin):
    """
    Official College Board Practice Test definition.

    Represents a complete practice test with all module variants.

    Attributes:
        id: Primary key
        test_number: Test number (1-6)
        test_name: Display name (e.g., "Practice Test 4")
        description: Additional context
        is_active: Whether test is available to students
        date_extracted: When questions were mapped
        note: Implementation notes
    """

    __tablename__ = "practice_tests"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Practice test UUID"
    )

    test_number = Column(
        Integer,
        nullable=False,
        unique=True,
        index=True,
        comment="Test number (1-6)"
    )

    test_name = Column(
        String(100),
        nullable=False,
        comment="Display name (e.g., 'SAT Practice Test 4')"
    )

    description = Column(
        Text,
        nullable=True,
        comment="Test description or context"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether test is available to students"
    )

    date_extracted = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When questions were mapped from Bluebook"
    )

    note = Column(
        Text,
        nullable=True,
        comment="Implementation notes"
    )

    # Metadata about the test
    test_metadata = Column(
        JSONB,
        nullable=True,
        comment="Additional metadata (source, version, etc.)"
    )

    # Relationships
    modules: Mapped[List["PracticeTestModule"]] = relationship(
        "PracticeTestModule",
        back_populates="practice_test",
        cascade="all, delete-orphan",
        order_by="PracticeTestModule.module_number"
    )

    __table_args__ = (
        {"comment": "Official College Board Practice Test definitions"}
    )


class PracticeTestModule(Base, TimestampMixin):
    """
    A module within a practice test (Module 1, Module 2 Easy, Module 2 Hard).

    Each module contains a specific set of questions in order.

    Attributes:
        id: Primary key
        practice_test_id: Parent practice test
        module_number: Module number (1 or 2)
        module_type: standard, easier, or harder
        subject_area: math or reading_writing
        time_limit_minutes: Official time limit
        question_count: Number of questions
        question_uids: Ordered list of question uIds
    """

    __tablename__ = "practice_test_modules"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Module UUID"
    )

    practice_test_id = Column(
        UUID(as_uuid=True),
        ForeignKey("practice_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent practice test"
    )

    module_number = Column(
        Integer,
        nullable=False,
        comment="Module number (1 or 2)"
    )

    module_type = Column(
        String(50),
        nullable=False,
        comment="module_1_standard, module_2_easier, or module_2_harder"
    )

    subject_area = Column(
        String(50),
        nullable=False,
        comment="math or reading_writing"
    )

    time_limit_minutes = Column(
        Integer,
        nullable=False,
        comment="Official time limit in minutes"
    )

    question_count = Column(
        Integer,
        nullable=False,
        comment="Number of questions in this module"
    )

    # Ordered list of question uIds
    question_uids = Column(
        JSONB,
        nullable=False,
        comment="Ordered array of question uIds"
    )

    # Difficulty distribution for this module
    difficulty_distribution = Column(
        JSONB,
        nullable=True,
        comment="Percentage of easy/medium/hard questions"
    )

    # Relationships
    practice_test: Mapped["PracticeTest"] = relationship(
        "PracticeTest",
        back_populates="modules"
    )

    __table_args__ = (
        Index(
            "uq_practice_test_module",
            "practice_test_id", "module_number", "module_type", "subject_area",
            unique=True
        ),
        {"comment": "Modules within practice tests with question mappings"}
    )


def get_module_key(subject_area: str, module_number: int, module_type: str) -> str:
    """
    Generate consistent module key for lookups.

    Examples:
        - get_module_key("reading_writing", 1, "standard") → "rw_module_1"
        - get_module_key("math", 2, "easier") → "math_module_2_easier"
    """
    subject_abbr = "rw" if subject_area == "reading_writing" else subject_area
    if module_number == 1:
        return f"{subject_abbr}_module_1"
    else:
        variant = "easier" if "easier" in module_type else "harder"
        return f"{subject_abbr}_module_2_{variant}"
