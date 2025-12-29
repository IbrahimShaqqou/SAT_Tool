"""
SAT Tutoring Platform - Invite Schemas

Pydantic schemas for invite link API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr

from app.models.enums import InviteStatus, SubjectArea, AssessmentType


class InviteCreate(BaseModel):
    """Schema for creating a new invite link."""
    title: Optional[str] = Field(None, max_length=200)
    assessment_type: AssessmentType = Field(AssessmentType.INTAKE, description="Type of assessment")
    subject_area: Optional[SubjectArea] = None  # null = both math and reading
    question_count: int = Field(40, ge=5, le=60)  # Default 40 for intake (5 per domain)
    time_limit_minutes: Optional[int] = Field(None, ge=5, le=180)
    expires_in_days: Optional[int] = Field(None, ge=1, le=30)
    is_adaptive: bool = Field(True, description="Use adaptive question selection")


class InviteBrief(BaseModel):
    """Brief invite info for list views."""
    id: UUID
    token: str
    title: Optional[str]
    assessment_type: AssessmentType = AssessmentType.INTAKE
    subject_area: Optional[SubjectArea]
    question_count: int
    time_limit_minutes: Optional[int]
    status: InviteStatus
    created_at: datetime
    expires_at: Optional[datetime]
    used_at: Optional[datetime]
    guest_name: Optional[str]
    guest_email: Optional[str]
    student_id: Optional[UUID] = None
    score_percentage: Optional[float] = None

    model_config = {"from_attributes": True}


class InviteListResponse(BaseModel):
    """Paginated list of invites."""
    items: List[InviteBrief]
    total: int
    limit: int
    offset: int


class InviteDetail(BaseModel):
    """Full invite details."""
    id: UUID
    token: str
    title: Optional[str]
    subject_area: Optional[SubjectArea]
    question_count: int
    time_limit_minutes: Optional[int]
    status: InviteStatus
    created_at: datetime
    expires_at: Optional[datetime]
    used_at: Optional[datetime]
    guest_name: Optional[str]
    guest_email: Optional[str]
    student_id: Optional[UUID]
    test_session_id: Optional[UUID]

    model_config = {"from_attributes": True}


class InviteLink(BaseModel):
    """Response after creating an invite with the full link."""
    id: UUID
    token: str
    link: str
    expires_at: Optional[datetime]


# Public assessment schemas (no auth required)

class AssessmentConfig(BaseModel):
    """Configuration for a public assessment."""
    token: str
    title: Optional[str]
    subject_area: Optional[SubjectArea]
    question_count: int
    time_limit_minutes: Optional[int]
    tutor_name: str
    # Session resume info
    has_in_progress_session: bool = False
    session_id: Optional[UUID] = None
    questions_answered: int = 0
    current_question_index: int = 0


class AssessmentStart(BaseModel):
    """Request to start an assessment."""
    guest_name: Optional[str] = Field(None, max_length=100)
    guest_email: Optional[EmailStr] = None


class AssessmentStartResponse(BaseModel):
    """Response after starting an assessment."""
    session_id: UUID
    total_questions: int
    time_limit_minutes: Optional[int]
    is_resuming: bool = False
    current_question_index: int = 0
    time_remaining_seconds: Optional[int] = None


class SessionStateUpdate(BaseModel):
    """Update session state (current position, flagged questions)."""
    current_question_index: Optional[int] = None
    flagged_question_ids: Optional[List[UUID]] = None
    time_spent_seconds: Optional[int] = None


class AssessmentQuestion(BaseModel):
    """Question in a public assessment."""
    order: int
    question_id: UUID
    prompt_html: str
    passage_html: Optional[str] = None
    answer_type: str
    choices: Optional[List[Dict[str, Any]]] = None


class AssessmentQuestionsResponse(BaseModel):
    """All questions for an assessment."""
    session_id: UUID
    total_questions: int
    time_limit_minutes: Optional[int]
    questions: List[AssessmentQuestion]


class AssessmentAnswerSubmit(BaseModel):
    """Submit an answer in assessment."""
    question_id: UUID
    answer: Dict[str, Any]
    time_spent_seconds: int = Field(0, ge=0)


class AssessmentAnswerResult(BaseModel):
    """Result after submitting an answer."""
    is_correct: bool
    correct_answer: Dict[str, Any]
    explanation_html: Optional[str] = None


class AssessmentSubmit(BaseModel):
    """Submit the entire assessment."""
    pass  # No body needed


class AssessmentComplete(BaseModel):
    """Response after completing an assessment."""
    score_percentage: float
    questions_correct: int
    total_questions: int
    time_spent_seconds: int


# =============================================================================
# Intake Assessment Results
# =============================================================================

class DomainResult(BaseModel):
    """Result for a single domain."""
    domain_id: int
    domain_name: str
    domain_code: str
    section: str
    theta: float = Field(..., description="Ability estimate (-3 to +3)")
    se: float = Field(..., description="Standard error of estimate")
    correct: int
    total: int
    accuracy: float


class SectionResult(BaseModel):
    """Result for a section (Math or Reading/Writing)."""
    section: str
    theta: float
    correct: int
    total: int
    accuracy: float
    predicted_score_low: int = Field(..., description="Lower bound SAT score")
    predicted_score_mid: int = Field(..., description="Middle estimate SAT score")
    predicted_score_high: int = Field(..., description="Upper bound SAT score")


class PriorityArea(BaseModel):
    """Area needing focused study."""
    domain_name: str
    current_level: str = Field(..., description="Descriptive level: Foundational, Beginning, Developing, Proficient, Advanced")
    recommendation: str


class CompositeScore(BaseModel):
    """Predicted composite SAT score range."""
    low: int
    mid: int
    high: int


class IntakeResultsResponse(BaseModel):
    """Comprehensive intake assessment results."""
    overall: Dict[str, Any] = Field(..., description="Overall statistics")
    section_abilities: List[SectionResult]
    domain_abilities: List[DomainResult]
    priority_areas: List[PriorityArea]
    predicted_composite: Optional[CompositeScore] = None
