"""
SAT Tutoring Platform - Invite Schemas

Pydantic schemas for invite link API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr

from app.models.enums import InviteStatus, SubjectArea


class InviteCreate(BaseModel):
    """Schema for creating a new invite link."""
    title: Optional[str] = Field(None, max_length=200)
    subject_area: Optional[SubjectArea] = None  # null = both math and reading
    question_count: int = Field(20, ge=5, le=50)
    time_limit_minutes: Optional[int] = Field(None, ge=5, le=180)
    expires_in_days: Optional[int] = Field(None, ge=1, le=30)


class InviteBrief(BaseModel):
    """Brief invite info for list views."""
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


class AssessmentStart(BaseModel):
    """Request to start an assessment."""
    guest_name: Optional[str] = Field(None, max_length=100)
    guest_email: Optional[EmailStr] = None


class AssessmentStartResponse(BaseModel):
    """Response after starting an assessment."""
    session_id: UUID
    total_questions: int
    time_limit_minutes: Optional[int]


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
