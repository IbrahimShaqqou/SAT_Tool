"""
SAT Tutoring Platform - Assignment Schemas

Pydantic schemas for assignment API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import AssignmentStatus, DifficultyLevel, SubjectArea


class AssignmentCreate(BaseModel):
    """Schema for creating a new assignment."""
    student_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    instructions: Optional[str] = None
    subject: SubjectArea
    question_count: Optional[int] = Field(10, ge=1, le=100, description="None for unlimited (adaptive only)")
    domain_id: Optional[int] = None
    skill_id: Optional[int] = None
    skill_ids: Optional[List[int]] = Field(None, description="Multiple skills for adaptive assignments")
    difficulty: Optional[DifficultyLevel] = None
    due_date: Optional[datetime] = None
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=180)
    target_score: Optional[int] = Field(None, ge=0, le=100)
    is_adaptive: bool = Field(False, description="Use IRT-based adaptive question selection")


class AssignmentUpdate(BaseModel):
    """Schema for updating an assignment."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    tutor_feedback: Optional[str] = None


class AssignmentBrief(BaseModel):
    """Brief assignment info for list views."""
    id: UUID
    title: str
    status: AssignmentStatus
    student_id: UUID
    student_name: str
    tutor_id: UUID
    tutor_name: str
    total_questions: Optional[int] = None  # None for unlimited adaptive
    questions_answered: int = 0
    score_percentage: Optional[float] = None
    due_date: Optional[datetime] = None
    created_at: datetime
    is_adaptive: bool = False
    time_limit_minutes: Optional[int] = None
    time_expired: bool = False

    model_config = {"from_attributes": True}


class AssignmentListResponse(BaseModel):
    """Paginated list of assignments."""
    items: List[AssignmentBrief]
    total: int
    limit: int
    offset: int


class CurrentAssignmentQuestion(BaseModel):
    """Current question in an assignment."""
    order: int
    question_id: UUID
    prompt_html: str
    choices: Optional[List[Dict[str, Any]]] = None
    is_answered: bool


class AssignmentDetail(BaseModel):
    """Full assignment details."""
    id: UUID
    title: str
    instructions: Optional[str] = None
    status: AssignmentStatus
    student_id: UUID
    student_name: str
    tutor_id: UUID
    tutor_name: str
    total_questions: Optional[int] = None  # None for unlimited adaptive
    questions_answered: int = 0
    questions_correct: int = 0
    current_question_index: int = 0
    score_percentage: Optional[float] = None
    due_date: Optional[datetime] = None
    time_limit_minutes: Optional[int] = None
    time_spent_seconds: int = 0  # Total time spent so far (for timer persistence)
    target_score: Optional[int] = None
    tutor_feedback: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    current_question: Optional[CurrentAssignmentQuestion] = None
    is_adaptive: bool = False

    model_config = {"from_attributes": True}


class AssignmentAnswerSubmit(BaseModel):
    """Schema for submitting an answer in an assignment."""
    question_id: Optional[UUID] = Field(None, description="Question ID to answer (for free navigation)")
    answer: Dict[str, Any] = Field(..., description="MCQ: {index: int}, SPR: {answer: str}")
    time_spent_seconds: int = Field(0, ge=0)


class AssignmentAnswerResult(BaseModel):
    """Result after submitting an answer."""
    is_correct: bool
    correct_answer: Dict[str, Any]
    explanation_html: Optional[str] = None
    next_question_index: Optional[int] = None
    assignment_complete: bool = False


class AssignmentStatusUpdate(BaseModel):
    """Response after status change."""
    id: UUID
    status: AssignmentStatus
    current_question_index: int = 0
    started_at: Optional[datetime] = None


class AssignmentSubmit(BaseModel):
    """Schema for submitting/completing an assignment."""
    time_expired: bool = Field(False, description="Whether timer ran out")


class AssignmentComplete(BaseModel):
    """Response after completing an assignment."""
    id: UUID
    status: AssignmentStatus
    score_percentage: float
    questions_correct: int
    total_questions: int  # For completed assignments, use questions_answered as total
    target_score: Optional[int] = None
    passed: bool
    time_expired: bool = False


class AssignmentQuestionItem(BaseModel):
    """Single question in an assignment (for test interface)."""
    order: int
    question_id: UUID
    prompt_html: str
    passage_html: Optional[str] = None
    answer_type: str = "MCQ"  # MCQ or SPR
    choices: Optional[List[Dict[str, Any]]] = None
    is_answered: bool = False
    selected_answer: Optional[Dict[str, Any]] = None
    correct_answer: Optional[Dict[str, Any]] = None
    explanation_html: Optional[str] = None


class AssignmentQuestionsResponse(BaseModel):
    """All questions for an assignment (for test interface)."""
    assignment_id: UUID
    title: str
    status: AssignmentStatus
    total_questions: Optional[int] = None  # None for unlimited adaptive
    time_limit_minutes: Optional[int] = None
    questions: List[AssignmentQuestionItem]
