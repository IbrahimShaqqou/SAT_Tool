"""
SAT Tutoring Platform - Pydantic Schemas

Request/response validation schemas for the API.
"""

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserLogin,
    UserUpdate,
    UserResponse,
    UserBrief,
)
from app.schemas.token import (
    Token,
    TokenPayload,
    RefreshTokenRequest,
)
from app.schemas.question import (
    ChoiceOption,
    QuestionBrief,
    QuestionDetail,
    QuestionListResponse,
    QuestionRandomResponse,
)
from app.schemas.taxonomy import (
    DomainBrief,
    DomainResponse,
    DomainListResponse,
    SkillResponse,
    SkillListResponse,
)
from app.schemas.practice import (
    PracticeSessionCreate,
    PracticeSessionBrief,
    PracticeSessionListResponse,
    PracticeSessionDetail,
    AnswerSubmit,
    AnswerResult,
    SessionStatusUpdate,
    SessionComplete,
    SessionResults,
)
from app.schemas.progress import (
    ProgressSummary,
    ResponseHistoryItem,
    ResponseHistoryResponse,
)
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentBrief,
    AssignmentListResponse,
    AssignmentDetail,
    AssignmentAnswerSubmit,
    AssignmentAnswerResult,
    AssignmentStatusUpdate,
    AssignmentComplete,
    AssignmentQuestionItem,
    AssignmentQuestionsResponse,
)
from app.schemas.tutor import (
    AddStudentRequest,
    StudentBrief,
    StudentListResponse,
    StudentProfile,
    StudentProgress,
    StudentSessionsResponse,
    StudentResponsesResponse,
    StudentWeaknesses,
    TutorAnalytics,
)

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserUpdate",
    "UserResponse",
    "UserBrief",
    # Token schemas
    "Token",
    "TokenPayload",
    "RefreshTokenRequest",
    # Question schemas
    "ChoiceOption",
    "QuestionBrief",
    "QuestionDetail",
    "QuestionListResponse",
    "QuestionRandomResponse",
    # Taxonomy schemas
    "DomainBrief",
    "DomainResponse",
    "DomainListResponse",
    "SkillResponse",
    "SkillListResponse",
    # Practice session schemas
    "PracticeSessionCreate",
    "PracticeSessionBrief",
    "PracticeSessionListResponse",
    "PracticeSessionDetail",
    "AnswerSubmit",
    "AnswerResult",
    "SessionStatusUpdate",
    "SessionComplete",
    "SessionResults",
    # Progress schemas
    "ProgressSummary",
    "ResponseHistoryItem",
    "ResponseHistoryResponse",
    # Assignment schemas
    "AssignmentCreate",
    "AssignmentUpdate",
    "AssignmentBrief",
    "AssignmentListResponse",
    "AssignmentDetail",
    "AssignmentAnswerSubmit",
    "AssignmentAnswerResult",
    "AssignmentStatusUpdate",
    "AssignmentComplete",
    "AssignmentQuestionItem",
    "AssignmentQuestionsResponse",
    # Tutor schemas
    "AddStudentRequest",
    "StudentBrief",
    "StudentListResponse",
    "StudentProfile",
    "StudentProgress",
    "StudentSessionsResponse",
    "StudentResponsesResponse",
    "StudentWeaknesses",
    "TutorAnalytics",
]
