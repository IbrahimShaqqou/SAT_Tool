"""
SAT Tutoring Platform - Enum Types

Database enum types for consistent data representation.
"""

import enum


class UserRole(str, enum.Enum):
    """User roles in the platform."""
    STUDENT = "student"
    TUTOR = "tutor"
    ADMIN = "admin"


class AnswerType(str, enum.Enum):
    """Question answer types from College Board data."""
    MCQ = "MCQ"  # Multiple Choice Question
    SPR = "SPR"  # Student-Produced Response


class DifficultyLevel(str, enum.Enum):
    """Question difficulty levels from College Board metadata."""
    EASY = "E"
    MEDIUM = "M"
    HARD = "H"


class TestType(str, enum.Enum):
    """Types of test sessions."""
    PRACTICE = "practice"           # Self-initiated practice
    ASSIGNED = "assigned"           # Tutor-assigned test
    DIAGNOSTIC = "diagnostic"       # Initial skill assessment
    FULL_LENGTH = "full_length"     # Complete SAT simulation
    ADAPTIVE = "adaptive"           # IRT-based adaptive practice


class TestStatus(str, enum.Enum):
    """Status of a test session."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class AssignmentStatus(str, enum.Enum):
    """Status of tutor assignments."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"


class SubjectArea(str, enum.Enum):
    """Main SAT subject areas."""
    MATH = "math"
    READING_WRITING = "reading_writing"


class MathDomain(str, enum.Enum):
    """Math domain codes from College Board."""
    ALGEBRA = "H"                    # Heart of Algebra
    PROBLEM_SOLVING = "P"            # Problem Solving and Data Analysis
    ADVANCED_MATH = "Q"              # Passport to Advanced Math
    ADDITIONAL_TOPICS = "S"          # Additional Topics in Math


class ReadingDomain(str, enum.Enum):
    """Reading/Writing domain codes from College Board."""
    INFORMATION_IDEAS = "INI"        # Information and Ideas
    CRAFT_STRUCTURE = "CAS"          # Craft and Structure
    EXPRESSION_IDEAS = "EOI"         # Expression of Ideas
    STANDARD_ENGLISH = "SEC"         # Standard English Conventions


class InviteStatus(str, enum.Enum):
    """Status of assessment invite links."""
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    REVOKED = "revoked"


class AssessmentType(str, enum.Enum):
    """Types of assessments for invite links."""
    INTAKE = "intake"           # Full diagnostic to establish baseline
    SECTION = "section"         # Math OR Reading/Writing only
    DOMAIN = "domain"           # Single domain focus
    QUICK_CHECK = "quick_check" # Quick skill verification
