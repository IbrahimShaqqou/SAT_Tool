"""
SAT Tutoring Platform - Taxonomy Models

Hierarchical organization: Domain -> Subdomain -> Skill
Based on College Board's SAT content organization.
"""

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, Column, Enum, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import SubjectArea

if TYPE_CHECKING:
    from app.models.question import Question


class Domain(Base, TimestampMixin):
    """
    Top-level content domain (e.g., Algebra, Problem Solving).

    Maps to College Board domain codes:
    - Math: H (Algebra), P (Problem Solving), Q (Advanced Math), S (Additional)
    - Reading: INI, CAS, EOI, SEC

    Attributes:
        id: Primary key
        code: College Board domain code (H, P, Q, S, INI, etc.)
        name: Human-readable domain name
        subject_area: math or reading_writing
        description: Detailed domain description
        display_order: For UI ordering
    """

    __tablename__ = "domains"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Domain primary key"
    )

    code = Column(
        String(10),
        unique=True,
        nullable=False,
        index=True,
        comment="College Board domain code (H, P, Q, S, INI, CAS, EOI, SEC)"
    )

    name = Column(
        String(100),
        nullable=False,
        comment="Human-readable domain name"
    )

    subject_area = Column(
        Enum(SubjectArea),
        nullable=False,
        index=True,
        comment="Subject area: math or reading_writing"
    )

    description = Column(
        Text,
        nullable=True,
        comment="Detailed domain description"
    )

    display_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order in UI"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether domain is active"
    )

    # Relationships
    subdomains: Mapped[List["Subdomain"]] = relationship(
        "Subdomain",
        back_populates="domain",
        order_by="Subdomain.display_order"
    )

    questions: Mapped[List["Question"]] = relationship(
        "Question",
        back_populates="domain"
    )

    __table_args__ = (
        Index("ix_domains_subject_active", "subject_area", "is_active"),
        {"comment": "Top-level SAT content domains"}
    )


class Subdomain(Base, TimestampMixin):
    """
    Second-level content classification within a domain.

    Examples:
    - Under Algebra (H): Linear Equations, Systems of Equations
    - Under Problem Solving (P): Ratios, Percentages, Data Analysis

    Attributes:
        id: Primary key
        domain_id: Parent domain reference
        code: Subdomain identifier code
        name: Human-readable name
        description: Detailed description
        display_order: For UI ordering
    """

    __tablename__ = "subdomains"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Subdomain primary key"
    )

    domain_id = Column(
        Integer,
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Parent domain ID"
    )

    code = Column(
        String(20),
        nullable=False,
        comment="Subdomain identifier code"
    )

    name = Column(
        String(150),
        nullable=False,
        comment="Human-readable subdomain name"
    )

    description = Column(
        Text,
        nullable=True,
        comment="Detailed subdomain description"
    )

    display_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order in UI"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether subdomain is active"
    )

    # Relationships
    domain: Mapped["Domain"] = relationship(
        "Domain",
        back_populates="subdomains"
    )

    skills: Mapped[List["Skill"]] = relationship(
        "Skill",
        back_populates="subdomain",
        order_by="Skill.display_order"
    )

    __table_args__ = (
        UniqueConstraint("domain_id", "code", name="uq_subdomain_domain_code"),
        Index("ix_subdomains_domain_active", "domain_id", "is_active"),
        {"comment": "Second-level content classification"}
    )


class Skill(Base, TimestampMixin):
    """
    Individual skill within a subdomain (most granular level).

    Maps to College Board's skill_cd from question metadata.
    Skills are the atomic units for:
    - Question classification
    - Student mastery tracking
    - Adaptive test selection

    Attributes:
        id: Primary key
        subdomain_id: Parent subdomain reference
        code: College Board skill code (skill_cd)
        name: Skill name (from skill_desc)
        description: Detailed skill description
        primary_class_desc: From CB's primary_class_cd_desc
    """

    __tablename__ = "skills"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Skill primary key"
    )

    subdomain_id = Column(
        Integer,
        ForeignKey("subdomains.id", ondelete="CASCADE"),
        nullable=True,  # Nullable since CB data doesn't have subdomain structure
        index=True,
        comment="Parent subdomain ID (optional)"
    )

    domain_id = Column(
        Integer,
        ForeignKey("domains.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Parent domain ID (used when no subdomain)"
    )

    code = Column(
        String(30),
        nullable=False,
        comment="College Board skill code (skill_cd)"
    )

    name = Column(
        String(200),
        nullable=False,
        comment="Skill name from skill_desc"
    )

    description = Column(
        Text,
        nullable=True,
        comment="Detailed skill description"
    )

    primary_class_desc = Column(
        String(200),
        nullable=True,
        comment="CB primary_class_cd_desc value"
    )

    display_order = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Display order in UI"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether skill is active"
    )

    # Relationships
    subdomain: Mapped[Optional["Subdomain"]] = relationship(
        "Subdomain",
        back_populates="skills"
    )

    domain: Mapped[Optional["Domain"]] = relationship(
        "Domain"
    )

    questions: Mapped[List["Question"]] = relationship(
        "Question",
        back_populates="skill"
    )

    __table_args__ = (
        UniqueConstraint("code", name="uq_skill_code"),  # Skill codes are globally unique
        Index("ix_skills_code", "code"),
        Index("ix_skills_domain_active", "domain_id", "is_active"),
        {"comment": "Individual skills (most granular classification)"}
    )
