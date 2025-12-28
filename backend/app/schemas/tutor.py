"""
SAT Tutoring Platform - Tutor Dashboard Schemas

Pydantic schemas for tutor dashboard API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr

from app.models.enums import SubjectArea


class AddStudentRequest(BaseModel):
    """Request to add a student to tutor's roster."""
    student_email: EmailStr


class StudentBrief(BaseModel):
    """Brief student info for list views."""
    id: UUID
    email: str
    first_name: str
    last_name: str
    overall_accuracy: Optional[float] = None
    total_questions_answered: int = 0
    assignments_pending: int = 0
    last_active_at: Optional[datetime] = None


class StudentListResponse(BaseModel):
    """List of tutor's students."""
    items: List[StudentBrief]
    total: int


class StudentProfile(BaseModel):
    """Full student profile."""
    id: UUID
    email: str
    first_name: str
    last_name: str
    created_at: datetime
    overall_accuracy: Optional[float] = None
    total_questions_answered: int = 0
    total_correct: int = 0
    sessions_completed: int = 0
    assignments_total: int = 0
    assignments_completed: int = 0
    last_active_at: Optional[datetime] = None


class SkillProgress(BaseModel):
    """Skill-level progress."""
    skill_id: int
    skill_name: str
    skill_code: str
    domain_name: str
    accuracy: float
    questions_attempted: int
    ability_theta: Optional[float] = None  # IRT ability estimate
    ability_se: Optional[float] = None  # Standard error of ability estimate


class DomainProgress(BaseModel):
    """Domain-level progress."""
    domain_id: int
    domain_name: str
    domain_code: str
    subject_area: SubjectArea
    accuracy: float
    questions_attempted: int


class StudentProgress(BaseModel):
    """Complete student progress."""
    student_id: UUID
    student_name: str
    overall_accuracy: float
    total_questions_answered: int
    sessions_completed: int
    skills: List[SkillProgress]
    domains: List[DomainProgress]


class SessionBrief(BaseModel):
    """Brief session info for student sessions list."""
    id: UUID
    test_type: str
    status: str
    subject_area: Optional[str] = None
    total_questions: int
    questions_answered: int
    score_percentage: Optional[float] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class StudentSessionsResponse(BaseModel):
    """Student's practice sessions."""
    items: List[SessionBrief]
    total: int
    limit: int
    offset: int


class ResponseItem(BaseModel):
    """Individual response in history."""
    id: UUID
    question_id: UUID
    question_prompt: str
    skill_name: Optional[str] = None
    your_answer: Dict[str, Any]
    correct_answer: Dict[str, Any]
    is_correct: bool
    time_spent_seconds: Optional[int] = None
    submitted_at: datetime


class StudentResponsesResponse(BaseModel):
    """Student's response history."""
    items: List[ResponseItem]
    total: int
    limit: int
    offset: int


class WeakSkill(BaseModel):
    """Skill that needs practice."""
    skill_id: int
    skill_name: str
    skill_code: str
    accuracy: float
    questions_attempted: int
    priority: str  # high, medium, low


class StudentWeaknesses(BaseModel):
    """Student's weak skills."""
    weak_skills: List[WeakSkill]
    recommended_focus: Optional[Dict[str, Any]] = None


class SkillStruggle(BaseModel):
    """Skill that multiple students struggle with."""
    skill_id: int
    skill_name: str
    avg_accuracy: float
    students_struggling: int


class TutorAnalytics(BaseModel):
    """Aggregate analytics for tutor's students."""
    total_students: int
    active_students_this_week: int
    total_assignments_created: int
    assignments_completed: int
    average_score: float
    common_struggles: List[SkillStruggle]


# Chart data schemas

class AccuracyDataPoint(BaseModel):
    """Single data point for accuracy trend chart."""
    date: str
    accuracy: float


class SkillChartData(BaseModel):
    """Data for skill breakdown bar chart."""
    name: str
    accuracy: float
    questions: int


class DomainChartData(BaseModel):
    """Data for domain radar chart."""
    domain: str
    accuracy: float
    fullMark: float = 100


class ActivityDay(BaseModel):
    """Activity heatmap data point."""
    date: str
    count: int


class TutorChartData(BaseModel):
    """All chart data for tutor analytics."""
    accuracy_trend: List[AccuracyDataPoint]
    skill_breakdown: List[SkillChartData]
    domain_performance: List[DomainChartData]
    activity_heatmap: List[ActivityDay]


class StudentChartData(BaseModel):
    """Chart data for individual student."""
    accuracy_trend: List[AccuracyDataPoint]
    skill_breakdown: List[SkillChartData]
    domain_performance: List[DomainChartData]
