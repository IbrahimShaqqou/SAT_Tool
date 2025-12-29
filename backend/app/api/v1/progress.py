"""
SAT Tutoring Platform - Student Progress API

Endpoints for viewing student progress (minimal student-facing view).
"""

from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.response import StudentResponse, StudentSkill
from app.models.test import TestSession
from app.models.invite import Invite
from app.models.taxonomy import Skill, Domain
from app.models.enums import TestStatus, SubjectArea
from app.schemas.progress import (
    ProgressSummary,
    ResponseHistoryItem,
    ResponseHistoryResponse,
)


class InProgressAssessment(BaseModel):
    """An in-progress assessment that can be resumed."""
    session_id: UUID
    invite_token: str
    title: Optional[str]
    subject_area: Optional[SubjectArea]
    total_questions: int
    questions_answered: int
    current_question_index: int
    time_limit_minutes: Optional[int]
    started_at: datetime
    tutor_name: str

    model_config = {"from_attributes": True}


class InProgressAssessmentsResponse(BaseModel):
    """Response containing in-progress assessments."""
    items: List[InProgressAssessment]

router = APIRouter()


@router.get("/summary", response_model=ProgressSummary)
def get_progress_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressSummary:
    """
    Get student's overall progress summary.

    Returns basic stats: total questions answered, accuracy, sessions completed.
    """
    # Count total responses and correct responses
    total_answered = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == current_user.id,
    ).scalar() or 0

    total_correct = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == current_user.id,
        StudentResponse.is_correct == True,
    ).scalar() or 0

    # Calculate accuracy
    accuracy = (total_correct / total_answered * 100) if total_answered > 0 else 0.0

    # Count completed sessions
    sessions_completed = db.query(func.count(TestSession.id)).filter(
        TestSession.student_id == current_user.id,
        TestSession.status == TestStatus.COMPLETED,
    ).scalar() or 0

    # Get last practice time
    last_response = db.query(StudentResponse.submitted_at).filter(
        StudentResponse.student_id == current_user.id,
    ).order_by(StudentResponse.submitted_at.desc()).first()

    last_practice_at = last_response[0] if last_response else None

    return ProgressSummary(
        total_questions_answered=total_answered,
        total_correct=total_correct,
        overall_accuracy=round(accuracy, 1),
        sessions_completed=sessions_completed,
        last_practice_at=last_practice_at,
    )


@router.get("/history", response_model=ResponseHistoryResponse)
def get_response_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ResponseHistoryResponse:
    """
    Get student's recent response history.

    Returns paginated list of question responses.
    """
    query = db.query(StudentResponse).filter(
        StudentResponse.student_id == current_user.id,
    )

    total = query.count()

    responses = query.order_by(
        StudentResponse.submitted_at.desc()
    ).offset(offset).limit(limit).all()

    items = [
        ResponseHistoryItem(
            id=r.id,
            question_id=r.question_id,
            is_correct=r.is_correct,
            submitted_at=r.submitted_at,
        )
        for r in responses
    ]

    return ResponseHistoryResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/in-progress", response_model=InProgressAssessmentsResponse)
def get_in_progress_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InProgressAssessmentsResponse:
    """
    Get student's in-progress assessments (from invite links).

    Returns assessments that were started but not completed,
    allowing the student to resume them from the dashboard.
    """
    # Find all invites linked to the current student with in-progress sessions
    invites = db.query(Invite).filter(
        Invite.student_id == current_user.id,
        Invite.test_session_id != None,
    ).all()

    items = []
    for invite in invites:
        # Get the test session
        session = db.query(TestSession).filter(
            TestSession.id == invite.test_session_id
        ).first()

        if not session or session.status != TestStatus.IN_PROGRESS:
            continue

        # Get tutor name
        tutor = db.query(User).filter(User.id == invite.tutor_id).first()
        tutor_name = f"{tutor.first_name} {tutor.last_name}" if tutor else "Your Tutor"

        items.append(InProgressAssessment(
            session_id=session.id,
            invite_token=invite.token,
            title=invite.title or session.title,
            subject_area=invite.subject_area,
            total_questions=session.total_questions or invite.question_count,
            questions_answered=session.questions_answered or 0,
            current_question_index=session.current_question_index or 0,
            time_limit_minutes=session.time_limit_minutes,
            started_at=session.started_at,
            tutor_name=tutor_name,
        ))

    # Sort by most recently started
    items.sort(key=lambda x: x.started_at, reverse=True)

    return InProgressAssessmentsResponse(items=items)


class SkillAbility(BaseModel):
    """Student's ability in a specific skill."""
    skill_id: int
    skill_name: str
    skill_code: str
    domain_name: str
    domain_code: str
    subject_area: str
    mastery_level: float
    ability_theta: Optional[float]
    questions_attempted: int
    questions_correct: int
    accuracy: float

    model_config = {"from_attributes": True}


class SkillsResponse(BaseModel):
    """Response containing student's skill abilities."""
    skills: List[SkillAbility]
    weak_skills: List[SkillAbility]  # Top 5 weakest skills
    strong_skills: List[SkillAbility]  # Top 5 strongest skills


@router.get("/skills", response_model=SkillsResponse)
def get_student_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SkillsResponse:
    """
    Get student's skill abilities.

    Returns all skills with mastery levels, plus top weak and strong skills.
    Used for displaying focus areas on the student dashboard.
    """
    # Get all student skills
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == current_user.id
    ).all()

    skills = []
    for sr in skill_records:
        skill = db.query(Skill).filter(Skill.id == sr.skill_id).first()
        if not skill:
            continue

        domain = db.query(Domain).filter(Domain.id == skill.domain_id).first()

        accuracy = (sr.questions_correct / sr.questions_attempted * 100) if sr.questions_attempted > 0 else 0

        skills.append(SkillAbility(
            skill_id=skill.id,
            skill_name=skill.name,
            skill_code=skill.code,
            domain_name=domain.name if domain else "Unknown",
            domain_code=domain.code if domain else "",
            subject_area=domain.subject_area.value if domain and domain.subject_area else "",
            mastery_level=sr.mastery_level or 0,
            ability_theta=round(sr.ability_theta, 2) if sr.ability_theta is not None else None,
            questions_attempted=sr.questions_attempted or 0,
            questions_correct=sr.questions_correct or 0,
            accuracy=round(accuracy, 1),
        ))

    # Sort by mastery level for weak/strong
    sorted_skills = sorted(skills, key=lambda x: x.mastery_level)

    # Get weak skills (lowest mastery, at least 1 question attempted)
    weak_skills = [s for s in sorted_skills if s.questions_attempted >= 1][:5]

    # Get strong skills (highest mastery, at least 1 question attempted)
    strong_skills = [s for s in sorted_skills if s.questions_attempted >= 1][-5:][::-1]

    return SkillsResponse(
        skills=skills,
        weak_skills=weak_skills,
        strong_skills=strong_skills,
    )
