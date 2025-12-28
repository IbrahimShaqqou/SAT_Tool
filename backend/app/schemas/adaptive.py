"""
SAT Tutoring Platform - Adaptive Testing Schemas

Pydantic schemas for adaptive testing and IRT-based features.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.question import ChoiceOption, DomainBrief, SkillBrief


# =============================================================================
# Ability Estimation Schemas
# =============================================================================

class AbilityEstimate(BaseModel):
    """Student ability estimate with uncertainty."""
    theta: float = Field(..., description="Ability estimate (-3 to +3 scale)")
    standard_error: float = Field(..., description="Standard error of estimate")
    confidence_low: float = Field(..., description="Lower 95% confidence bound")
    confidence_high: float = Field(..., description="Upper 95% confidence bound")
    response_count: int = Field(0, description="Number of responses used")


class SkillAbility(BaseModel):
    """Ability estimate for a specific skill."""
    skill_id: int
    skill_name: str
    skill_code: str
    ability: AbilityEstimate
    mastery_level: float = Field(..., description="Mastery on 0-100 scale")
    last_practiced: Optional[datetime] = None


class AbilityProfile(BaseModel):
    """Complete ability profile for a student."""
    student_id: UUID
    overall_ability: AbilityEstimate
    skill_abilities: List[SkillAbility]
    total_responses: int
    last_updated: datetime


# =============================================================================
# Adaptive Session Schemas
# =============================================================================

class AdaptiveSessionCreate(BaseModel):
    """Request to create an adaptive practice session."""
    skill_ids: List[int] = Field(..., min_length=1, description="Skills to practice")
    question_count: int = Field(10, ge=5, le=50, description="Target question count")
    time_limit_minutes: Optional[int] = Field(None, ge=5, le=180)


class AdaptiveQuestionInfo(BaseModel):
    """Question with IRT information for adaptive sessions."""
    id: UUID
    prompt_html: str
    passage_html: Optional[str] = None
    choices: Optional[List[ChoiceOption]] = None
    skill: Optional[SkillBrief] = None
    domain: Optional[DomainBrief] = None
    # IRT parameters (for debugging/transparency)
    difficulty_b: Optional[float] = None
    expected_probability: Optional[float] = None


class AdaptiveSessionDetail(BaseModel):
    """Adaptive session state with current question."""
    id: UUID
    status: str
    skill_ids: List[int]
    total_questions: int
    questions_answered: int
    current_ability: AbilityEstimate
    time_limit_minutes: Optional[int] = None
    time_spent_seconds: int = 0
    started_at: Optional[datetime] = None
    current_question: Optional[AdaptiveQuestionInfo] = None


class AdaptiveAnswerSubmit(BaseModel):
    """Submit answer in adaptive session."""
    answer: Dict[str, Any] = Field(..., description="MCQ: {index: int}, SPR: {answer: str}")
    time_spent_seconds: int = Field(0, ge=0)


class AdaptiveAnswerResult(BaseModel):
    """Result of adaptive answer with updated ability."""
    is_correct: bool
    correct_answer: Dict[str, Any]
    explanation_html: Optional[str] = None
    ability_before: AbilityEstimate
    ability_after: AbilityEstimate
    ability_change: float = Field(..., description="Change in theta")
    next_question: Optional[AdaptiveQuestionInfo] = None
    session_complete: bool = False
    questions_remaining: int = 0


class AdaptiveSessionComplete(BaseModel):
    """Completed adaptive session results."""
    id: UUID
    score_percentage: float
    questions_correct: int
    total_questions: int
    time_spent_seconds: int
    ability_start: AbilityEstimate
    ability_end: AbilityEstimate
    ability_growth: float
    skill_progress: List[SkillAbility]


# =============================================================================
# Next Question Selection
# =============================================================================

class NextQuestionRequest(BaseModel):
    """Request for next adaptive question."""
    skill_id: Optional[int] = Field(None, description="Specific skill to target")
    exclude_ids: List[UUID] = Field(default_factory=list, description="Questions to exclude")


class NextQuestionResponse(BaseModel):
    """Response with next adaptive question."""
    question: AdaptiveQuestionInfo
    current_ability: AbilityEstimate
    expected_information: float = Field(..., description="Information this question provides")


# =============================================================================
# IRT Calibration Schemas
# =============================================================================

class IRTParameters(BaseModel):
    """IRT parameters for a question."""
    difficulty_b: float = Field(..., description="Difficulty (-3 to +3)")
    discrimination_a: float = Field(..., description="Discrimination (0.5 to 2.5)")
    guessing_c: float = Field(..., description="Guessing (0 to 0.5)")


class CalibrationStats(BaseModel):
    """Statistics about IRT calibration coverage."""
    total_questions: int
    coverage: Dict[str, int]
    percentages: Dict[str, float]
    parameter_ranges: Dict[str, Dict[str, Optional[float]]]


class CalibrationResult(BaseModel):
    """Result of running calibration."""
    success: bool
    message: str
    stats: Dict[str, int]


# =============================================================================
# Question with IRT Info (for tutor view)
# =============================================================================

class QuestionIRTInfo(BaseModel):
    """Question with full IRT information for tutors."""
    id: UUID
    external_id: str
    prompt_html: str
    difficulty_b: Optional[float] = None
    discrimination_a: Optional[float] = None
    guessing_c: Optional[float] = None
    score_band_range: Optional[str] = None
    difficulty_level: Optional[str] = None
    skill_name: Optional[str] = None
    domain_name: Optional[str] = None
