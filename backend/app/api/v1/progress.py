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
from app.schemas.adaptive import SkillMasteryInfo, SkillMasteryResponse
from app.services.irt_service import (
    MasteryLevel,
    MASTERY_LEVEL_NAMES,
    MASTERY_LEVEL_COLORS,
    get_effective_mastery_level,
    _days_since_practice,
    STALE_SKILL_THRESHOLD_DAYS,
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


def _build_skill_mastery_info(
    sr: StudentSkill,
    skill: Skill,
    domain: Optional[Domain]
) -> SkillMasteryInfo:
    """Build SkillMasteryInfo from a StudentSkill record."""
    # Get stored mastery level enum (default to 0 if not set)
    stored_level = MasteryLevel(sr.mastery_level_enum) if sr.mastery_level_enum is not None else MasteryLevel.NOT_STARTED

    # Apply decay for display
    effective_level, is_stale = get_effective_mastery_level(stored_level, sr.last_practiced_at)

    # Calculate accuracy percentages
    total = sr.questions_attempted or 0
    correct = sr.questions_correct or 0
    accuracy = (correct / total * 100) if total > 0 else 0.0

    hard_total = sr.hard_questions_total or 0
    hard_correct = sr.hard_questions_correct or 0
    hard_accuracy = (hard_correct / hard_total * 100) if hard_total > 0 else 0.0

    medium_total = sr.medium_questions_total or 0
    medium_correct = sr.medium_questions_correct or 0
    medium_accuracy = (medium_correct / medium_total * 100) if medium_total > 0 else 0.0

    # Determine confidence level based on response count
    if total >= 15:
        confidence = "high"
    elif total >= 5:
        confidence = "medium"
    else:
        confidence = "low"

    # Calculate days since practice
    days_since = _days_since_practice(sr.last_practiced_at)
    days_since = min(days_since, 9999)  # Cap for display

    # Determine if needs review
    needs_review = (
        is_stale or
        (effective_level.value < MasteryLevel.MASTERED.value and days_since > 7) or
        (effective_level == MasteryLevel.FAMILIAR and accuracy < 60)
    )

    # Determine next level and requirements
    next_level = None
    requirements_met = {}
    progress_percent = 0.0

    if effective_level == MasteryLevel.NOT_STARTED:
        next_level = MASTERY_LEVEL_NAMES[MasteryLevel.FAMILIAR]
        requirements_met = {
            "responses": total >= 3,
            "accuracy": accuracy >= 50,
        }
        progress_percent = sum(requirements_met.values()) / len(requirements_met) * 100
    elif effective_level == MasteryLevel.FAMILIAR:
        next_level = MASTERY_LEVEL_NAMES[MasteryLevel.PROFICIENT]
        theta = sr.ability_theta or 0
        requirements_met = {
            "responses": total >= 5,
            "medium_accuracy": medium_accuracy >= 70 and medium_total >= 3,
            "theta": theta >= 0,
        }
        progress_percent = sum(requirements_met.values()) / len(requirements_met) * 100
    elif effective_level == MasteryLevel.PROFICIENT:
        next_level = MASTERY_LEVEL_NAMES[MasteryLevel.MASTERED]
        theta = sr.ability_theta or 0
        requirements_met = {
            "responses": total >= 8,
            "hard_accuracy": hard_accuracy >= 80 and hard_total >= 3,
            "theta": theta >= 1.0,
            "recency": days_since <= 14,
        }
        progress_percent = sum(requirements_met.values()) / len(requirements_met) * 100
    elif effective_level == MasteryLevel.MASTERED:
        next_level = None
        requirements_met = {}
        progress_percent = 100.0

    return SkillMasteryInfo(
        skill_id=skill.id,
        skill_name=skill.name,
        skill_code=skill.code,
        domain_name=domain.name if domain else None,
        domain_code=domain.code if domain else None,
        subject_area=domain.subject_area.value if domain and domain.subject_area else None,
        mastery_level=effective_level.value,
        mastery_level_name=MASTERY_LEVEL_NAMES[effective_level],
        mastery_level_color=MASTERY_LEVEL_COLORS[effective_level],
        responses_count=total,
        accuracy_percent=round(accuracy, 1),
        theta=round(sr.ability_theta, 2) if sr.ability_theta is not None else None,
        confidence=confidence,
        hard_responses_count=hard_total,
        hard_accuracy_percent=round(hard_accuracy, 1),
        medium_responses_count=medium_total,
        medium_accuracy_percent=round(medium_accuracy, 1),
        next_level=next_level,
        requirements_met=requirements_met,
        progress_percent=round(progress_percent, 1),
        days_since_practice=days_since if days_since < 9999 else 0,
        last_practiced_at=sr.last_practiced_at,
        is_stale=is_stale,
        needs_review=needs_review,
        mastery_percentage=sr.mastery_level or 0.0,
    )


@router.get("/skills", response_model=SkillMasteryResponse)
def get_student_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SkillMasteryResponse:
    """
    Get student's skill mastery using Khan Academy-style 4-level system.

    Returns all skills with mastery levels (Not Started, Familiar, Proficient, Mastered),
    plus weak/strong skills and summary statistics.

    Mastery levels:
    - 0 (Not Started): No practice yet
    - 1 (Familiar): 3+ responses, 50%+ accuracy
    - 2 (Proficient): 5+ responses, 70%+ on medium+, theta ≥ 0
    - 3 (Mastered): 8+ responses, 80%+ on hard, theta ≥ 1, practiced within 14 days
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
        skill_info = _build_skill_mastery_info(sr, skill, domain)
        skills.append(skill_info)

    # Sort by mastery level (ascending) for weak skills, descending for strong
    sorted_by_mastery = sorted(skills, key=lambda x: (x.mastery_level, x.accuracy_percent))

    # Get weak skills (lowest mastery level, at least 1 question attempted)
    weak_skills = [s for s in sorted_by_mastery if s.responses_count >= 1][:5]

    # Get strong skills (highest mastery level, at least 1 question attempted)
    strong_skills = [s for s in sorted_by_mastery if s.responses_count >= 1][-5:][::-1]

    # Calculate summary stats
    total_practiced = len([s for s in skills if s.responses_count > 0])
    mastered_count = len([s for s in skills if s.mastery_level == MasteryLevel.MASTERED.value])
    proficient_count = len([s for s in skills if s.mastery_level == MasteryLevel.PROFICIENT.value])
    familiar_count = len([s for s in skills if s.mastery_level == MasteryLevel.FAMILIAR.value])
    not_started_count = len([s for s in skills if s.mastery_level == MasteryLevel.NOT_STARTED.value])
    needs_review = len([s for s in skills if s.needs_review])

    return SkillMasteryResponse(
        skills=skills,
        weak_skills=weak_skills,
        strong_skills=strong_skills,
        needs_review_count=needs_review,
        total_skills_practiced=total_practiced,
        skills_mastered=mastered_count,
        skills_proficient=proficient_count,
        skills_familiar=familiar_count,
        skills_not_started=not_started_count,
    )
