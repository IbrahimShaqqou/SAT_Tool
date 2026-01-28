"""
SAT Tutoring Platform - Adaptive Testing Schemas

Pydantic schemas for adaptive testing and IRT-based features.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union
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
    question_count: Optional[int] = Field(None, ge=1, le=100, description="Target question count (None for infinite)")
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
    total_questions: Optional[int] = None  # None means infinite
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
    questions_remaining: Optional[int] = None  # None for infinite sessions


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


# =============================================================================
# Stale Skills & Tutor Analytics
# =============================================================================

class StaleSkill(BaseModel):
    """A skill that needs review due to inactivity."""
    skill_id: int
    skill_name: str
    days_since_practice: int = Field(..., description="Days since last practice")
    original_theta: float = Field(..., description="Original ability estimate")
    decayed_theta: float = Field(..., description="Decayed ability after inactivity")
    responses_count: int = Field(..., description="Total responses for this skill")
    mastery_level: float = Field(..., description="Current mastery level (0-100)")


class StaleSkillsResponse(BaseModel):
    """Response containing stale skills for a student."""
    student_id: UUID
    stale_skills: List[StaleSkill]
    threshold_days: int = Field(..., description="Days of inactivity to be considered stale")


class DomainAbilityInfo(BaseModel):
    """Domain-level ability information."""
    domain_id: int
    domain_name: str
    ability_theta: float
    ability_se: float
    responses_count: int
    last_updated: Optional[datetime] = None


class SectionAbilityInfo(BaseModel):
    """Section-level ability information with score prediction."""
    section: str = Field(..., description="'math' or 'reading_writing'")
    ability_theta: float
    ability_se: float
    responses_count: int
    predicted_score_low: Optional[int] = Field(None, description="Lower bound of predicted SAT score (200-800)")
    predicted_score_high: Optional[int] = Field(None, description="Upper bound of predicted SAT score (200-800)")
    last_updated: Optional[datetime] = None


class HierarchicalAbilityProfile(BaseModel):
    """Complete hierarchical ability profile for a student."""
    student_id: UUID
    section_abilities: List[SectionAbilityInfo]
    domain_abilities: List[DomainAbilityInfo]
    skill_abilities: List[SkillAbility]
    stale_skills_count: int = Field(0, description="Number of skills needing review")


# =============================================================================
# Unified Mastery System Schemas
# =============================================================================

class MasteryRequirement(BaseModel):
    """Requirement status for a mastery level."""
    name: str = Field(..., description="Requirement name (e.g., 'responses', 'accuracy')")
    needed: Any = Field(..., description="Required value")
    current: Any = Field(..., description="Current value")
    met: bool = Field(..., description="Whether requirement is met")


class SkillMasteryInfo(BaseModel):
    """
    Unified mastery information for a skill.

    This is the standard schema for displaying mastery to both students and tutors.
    Uses Khan Academy-style 4-level system: Not Started → Familiar → Proficient → Mastered
    """
    skill_id: int
    skill_name: str
    skill_code: str
    domain_name: Optional[str] = None
    domain_code: Optional[str] = None
    subject_area: Optional[str] = None

    # Mastery level (0-3)
    mastery_level: int = Field(..., description="0=Not Started, 1=Familiar, 2=Proficient, 3=Mastered")
    mastery_level_name: str = Field(..., description="Human-readable level name")
    mastery_level_color: str = Field(..., description="Color for UI: gray, blue, green, gold")

    # Progress details
    responses_count: int = Field(0, description="Total questions answered for this skill")
    accuracy_percent: float = Field(0.0, description="Overall accuracy percentage")
    theta: Optional[float] = Field(None, description="IRT ability estimate")
    confidence: str = Field("low", description="Confidence level: 'low', 'medium', 'high'")

    # Difficulty-specific stats
    hard_responses_count: int = Field(0, description="Hard questions attempted (b >= 1.0)")
    hard_accuracy_percent: float = Field(0.0, description="Accuracy on hard questions")
    medium_responses_count: int = Field(0, description="Medium+ questions attempted (b >= 0)")
    medium_accuracy_percent: float = Field(0.0, description="Accuracy on medium+ questions")

    # Next level requirements
    next_level: Optional[str] = Field(None, description="Name of next level (None if at max)")
    requirements_met: Dict[str, bool] = Field(default_factory=dict, description="Which requirements are met")
    progress_percent: float = Field(0.0, description="Progress toward next level (0-100)")

    # Recency
    days_since_practice: int = Field(0, description="Days since last practice")
    last_practiced_at: Optional[datetime] = None
    is_stale: bool = Field(False, description="True if mastery has decayed due to inactivity")
    needs_review: bool = Field(False, description="Suggest practicing this skill")

    # Legacy percentage (for backwards compatibility)
    mastery_percentage: float = Field(0.0, description="Legacy 0-100 mastery percentage")


class SkillMasteryResponse(BaseModel):
    """Response containing student's skill mastery information."""
    skills: List[SkillMasteryInfo]
    weak_skills: List[SkillMasteryInfo] = Field(default_factory=list, description="Skills needing most work")
    strong_skills: List[SkillMasteryInfo] = Field(default_factory=list, description="Best performing skills")
    needs_review_count: int = Field(0, description="Count of skills needing review")

    # Summary stats
    total_skills_practiced: int = Field(0)
    skills_mastered: int = Field(0)
    skills_proficient: int = Field(0)
    skills_familiar: int = Field(0)
    skills_not_started: int = Field(0)
