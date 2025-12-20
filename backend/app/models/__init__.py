"""
SAT Tutoring Platform - SQLAlchemy Models

Database models for the SAT tutoring platform.

Model Organization:
- User: Student and tutor accounts (user.py)
- Domain/Subdomain/Skill: Content taxonomy (taxonomy.py)
- Question/QuestionVersion: Question bank (question.py)
- StudentResponse/StudentSkill: Response tracking (response.py)
- TestSession/TestQuestion: Test sessions (test.py)
- Assignment/AssignmentQuestion: Tutor assignments (assignment.py)
"""

# Enums
from app.models.enums import (
    UserRole,
    AnswerType,
    DifficultyLevel,
    TestType,
    TestStatus,
    AssignmentStatus,
    SubjectArea,
    MathDomain,
    ReadingDomain,
)

# Base mixins
from app.models.base import (
    TimestampMixin,
    SoftDeleteMixin,
    VersionMixin,
)

# Users
from app.models.user import User

# Taxonomy
from app.models.taxonomy import Domain, Subdomain, Skill

# Questions
from app.models.question import Question, QuestionVersion, QuestionRelation

# Responses
from app.models.response import StudentResponse, StudentSkill

# Tests
from app.models.test import TestSession, TestQuestion

# Assignments
from app.models.assignment import Assignment, AssignmentQuestion


__all__ = [
    # Enums
    "UserRole",
    "AnswerType",
    "DifficultyLevel",
    "TestType",
    "TestStatus",
    "AssignmentStatus",
    "SubjectArea",
    "MathDomain",
    "ReadingDomain",
    # Mixins
    "TimestampMixin",
    "SoftDeleteMixin",
    "VersionMixin",
    # Models
    "User",
    "Domain",
    "Subdomain",
    "Skill",
    "Question",
    "QuestionVersion",
    "QuestionRelation",
    "StudentResponse",
    "StudentSkill",
    "TestSession",
    "TestQuestion",
    "Assignment",
    "AssignmentQuestion",
]
