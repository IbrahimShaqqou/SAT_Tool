"""
SAT Tutoring Platform - Practice Session Schemas

Pydantic schemas for practice session API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import DifficultyLevel, SubjectArea, TestStatus, TestType
from app.schemas.question import ChoiceOption, DomainBrief, SkillBrief


class PracticeSessionCreate(BaseModel):
    """Schema for creating a new practice session."""
    subject: SubjectArea
    question_count: int = Field(10, ge=1, le=50, description="Number of questions")
    domain_id: Optional[int] = Field(None, description="Filter by domain")
    skill_id: Optional[int] = Field(None, description="Filter by skill")
    difficulty: Optional[DifficultyLevel] = Field(None, description="Filter by difficulty")
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=180, description="Time limit")


class PracticeSessionBrief(BaseModel):
    """Brief session info for list views."""
    id: UUID
    status: TestStatus
    test_type: TestType
    subject_area: Optional[SubjectArea] = None
    total_questions: int
    questions_answered: int
    questions_correct: Optional[int] = None
    score_percentage: Optional[float] = None
    time_limit_minutes: Optional[int] = None
    time_spent_seconds: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PracticeSessionListResponse(BaseModel):
    """Paginated list of practice sessions."""
    items: List[PracticeSessionBrief]
    total: int
    limit: int
    offset: int


class QuestionInSession(BaseModel):
    """Question details within a session context."""
    id: UUID
    prompt_html: str
    choices: Optional[List[ChoiceOption]] = None
    difficulty: Optional[DifficultyLevel] = None
    domain: Optional[DomainBrief] = None
    skill: Optional[SkillBrief] = None


class CurrentQuestion(BaseModel):
    """Current question with session context."""
    order: int
    question: QuestionInSession
    is_answered: bool
    is_flagged: bool


class PracticeSessionDetail(BaseModel):
    """Full session details with current question."""
    id: UUID
    status: TestStatus
    test_type: TestType
    subject_area: Optional[SubjectArea] = None
    total_questions: int
    current_question_index: int
    questions_answered: int
    time_limit_minutes: Optional[int] = None
    time_spent_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    current_question: Optional[CurrentQuestion] = None

    model_config = {"from_attributes": True}


class AnswerSubmit(BaseModel):
    """Schema for submitting an answer."""
    answer: Dict[str, Any] = Field(..., description="MCQ: {index: int}, SPR: {answer: str}")
    time_spent_seconds: int = Field(0, ge=0, description="Time spent on question")
    flagged_for_review: bool = Field(False, description="Flag for later review")


class AnswerResult(BaseModel):
    """Result after submitting an answer."""
    is_correct: bool
    correct_answer: Dict[str, Any]
    explanation_html: Optional[str] = None
    next_question_index: Optional[int] = None
    session_complete: bool = False


class SessionStatusUpdate(BaseModel):
    """Response after status change (start/pause/resume)."""
    id: UUID
    status: TestStatus
    current_question_index: int
    time_spent_seconds: Optional[int] = None
    started_at: Optional[datetime] = None


class SessionComplete(BaseModel):
    """Response after completing a session."""
    id: UUID
    status: TestStatus
    score_percentage: float
    questions_correct: int
    total_questions: int
    time_spent_seconds: int


class QuestionResult(BaseModel):
    """Individual question result for results view."""
    order: int
    question_id: UUID
    prompt_html: str
    choices: Optional[List[ChoiceOption]] = None
    your_answer: Optional[Dict[str, Any]] = None
    correct_answer: Dict[str, Any]
    is_correct: bool
    explanation_html: Optional[str] = None
    time_spent_seconds: Optional[int] = None
    skill: Optional[SkillBrief] = None


class SkillBreakdown(BaseModel):
    """Score breakdown by skill."""
    skill_id: int
    skill_name: str
    correct: int
    total: int
    percentage: float


class SessionResults(BaseModel):
    """Detailed results for a completed session."""
    id: UUID
    status: TestStatus
    score_percentage: float
    questions_correct: int
    total_questions: int
    time_spent_seconds: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    questions: List[QuestionResult]
    skill_breakdown: List[SkillBreakdown]
