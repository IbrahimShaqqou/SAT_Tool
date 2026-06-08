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
from app.models.taxonomy import Skill, Domain
from app.models.lesson import Lesson, LessonCompletion
from app.models.enums import TestStatus, SubjectArea, TestType
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

    # Check if student has completed a diagnostic
    has_diagnostic = db.query(func.count(TestSession.id)).filter(
        TestSession.student_id == current_user.id,
        TestSession.test_type == TestType.DIAGNOSTIC,
        TestSession.status == TestStatus.COMPLETED,
    ).scalar() > 0

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
        has_diagnostic=has_diagnostic,
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



def _build_skill_mastery_info(
    sr: StudentSkill,
    skill: Skill,
    domain: Optional[Domain],
    lesson: Optional[Lesson] = None,
    lesson_completed: bool = False,
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
        ability_se=round(sr.ability_se, 2) if sr.ability_se is not None else None,
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
        lesson_id=str(lesson.id) if lesson else None,
        lesson_completed=lesson_completed,
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

    # Preload lessons for all practiced skills
    skill_ids = [sr.skill_id for sr in skill_records]
    lessons_map: dict = {}
    if skill_ids:
        lessons = db.query(Lesson).filter(Lesson.skill_id.in_(skill_ids)).all()
        lessons_map = {lesson.skill_id: lesson for lesson in lessons}

    # Preload lesson completions for this student
    lesson_ids = [l.id for l in lessons_map.values()]
    completed_set: set = set()
    if lesson_ids:
        completions = db.query(LessonCompletion).filter(
            LessonCompletion.lesson_id.in_(lesson_ids),
            LessonCompletion.student_id == current_user.id,
        ).all()
        completed_set = {str(c.lesson_id) for c in completions}

    skills = []
    for sr in skill_records:
        skill = db.query(Skill).filter(Skill.id == sr.skill_id).first()
        if not skill:
            continue

        domain = db.query(Domain).filter(Domain.id == skill.domain_id).first()
        lesson = lessons_map.get(skill.id)
        lesson_done = str(lesson.id) in completed_set if lesson else False
        skill_info = _build_skill_mastery_info(sr, skill, domain, lesson=lesson, lesson_completed=lesson_done)
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


@router.get("/score-history")
def get_score_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the student's SAT score history over time.
    Returns completed diagnostic and full-length test sessions with predicted scores.
    """
    sessions = (
        db.query(TestSession)
        .filter(
            TestSession.student_id == current_user.id,
            TestSession.status == TestStatus.COMPLETED,
            TestSession.test_type.in_([TestType.DIAGNOSTIC, TestType.PRACTICE]),
        )
        .order_by(TestSession.completed_at.asc())
        .all()
    )

    # Compute a predicted composite score for each session directly.
    from app.services.intake_service import calculate_intake_results
    history = []
    for session in sessions:
        results = calculate_intake_results(db, session.id)
        composite = results.get("predicted_composite")
        if not composite:
            continue

        history.append({
            "date": session.completed_at.isoformat() if session.completed_at else None,
            "estimated_score": composite["mid"],
            "score_low": composite["low"],
            "score_high": composite["high"],
            "type": session.test_type.value,
            "session_id": str(session.id),
        })

    return {"history": history}
