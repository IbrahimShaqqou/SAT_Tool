"""
SAT Tutoring Platform - Study Recommendations API

Generates a personalized daily study plan for students.
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.response import StudentSkill
from app.models.lesson import Lesson, LessonCompletion
from app.models.taxonomy import Skill, Domain
from app.services.irt_service import MasteryLevel, get_effective_mastery_level

router = APIRouter()


@router.get("/study-plan")
def get_study_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a personalized daily study plan (3-5 tasks).

    Priority order:
    1. Stale mastery (fading skills — practice them)
    2. Near level-up (≥60% progress toward next level)
    3. Unread lessons (skill with mastery 0-1 + unpracticed lesson)
    4. Daily nudge (if no activity in 2+ days)
    """
    now = datetime.now(timezone.utc)
    tasks = []

    # Get all practiced skills
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == current_user.id,
        StudentSkill.questions_attempted > 0,
    ).all()

    stale_tasks = []
    near_levelup_tasks = []

    for sr in skill_records:
        skill = db.query(Skill).filter(Skill.id == sr.skill_id).first()
        if not skill:
            continue

        stored_level = MasteryLevel(sr.mastery_level_enum) if sr.mastery_level_enum is not None else MasteryLevel.NOT_STARTED
        effective_level, is_stale = get_effective_mastery_level(stored_level, sr.last_practiced_at)

        if is_stale and len(stale_tasks) < 2:
            stale_tasks.append({
                "type": "review",
                "title": f"Review {skill.name}",
                "description": f"Your mastery of {skill.name} is fading — answer 5 questions to keep it fresh.",
                "cta_label": "Review Now",
                "cta_href": f"/student/adaptive?skill={skill.id}&autostart=true",
                "estimated_minutes": 10,
                "skill_id": skill.id,
                "skill_name": skill.name,
            })

        # Near level-up: Familiar with high progress
        if effective_level == MasteryLevel.FAMILIAR and len(near_levelup_tasks) < 2:
            total = sr.questions_attempted or 0
            correct = sr.questions_correct or 0
            accuracy = (correct / total * 100) if total > 0 else 0

            medium_total = sr.medium_questions_total or 0
            medium_correct = sr.medium_questions_correct or 0
            medium_accuracy = (medium_correct / medium_total * 100) if medium_total > 0 else 0

            theta = sr.ability_theta or 0
            reqs = [total >= 5, medium_accuracy >= 70 and medium_total >= 3, theta >= 0]
            progress = sum(reqs) / len(reqs) * 100

            if progress >= 60:
                near_levelup_tasks.append({
                    "type": "level_up",
                    "title": f"Almost Proficient in {skill.name}",
                    "description": f"You're close to leveling up — keep practicing to reach Proficient.",
                    "cta_label": "Practice Now",
                    "cta_href": f"/student/adaptive?skill={skill.id}&autostart=true",
                    "estimated_minutes": 15,
                    "skill_id": skill.id,
                    "skill_name": skill.name,
                })

    tasks.extend(stale_tasks[:2])
    tasks.extend(near_levelup_tasks[:2])

    # Lesson recommendations: skill with low mastery + unread lesson
    if len(tasks) < 4:
        # Find lessons not yet completed by this student
        practiced_lessons = db.query(LessonCompletion.lesson_id).filter(
            LessonCompletion.student_id == current_user.id
        ).subquery()

        unread_lessons = (
            db.query(Lesson)
            .filter(
                Lesson.status == "published",
                Lesson.id.notin_(db.query(practiced_lessons)),
            )
            .limit(3)
            .all()
        )

        for lesson in unread_lessons:
            if len(tasks) >= 4:
                break
            skill = db.query(Skill).filter(Skill.id == lesson.skill_id).first()
            tasks.append({
                "type": "lesson",
                "title": f"Study: {lesson.title}",
                "description": f"Build your foundation before practicing — learn the key concepts.",
                "cta_label": "Start Lesson",
                "cta_href": f"/student/lessons/{str(lesson.id)}",
                "estimated_minutes": lesson.estimated_minutes or 10,
                "skill_id": lesson.skill_id,
                "skill_name": skill.name if skill else None,
            })

    # Daily nudge if no activity recently
    if len(tasks) < 3:
        last_practiced = max(
            (sr.last_practiced_at for sr in skill_records if sr.last_practiced_at),
            default=None
        )
        days_inactive = (now - last_practiced.replace(tzinfo=timezone.utc)).days if last_practiced else 99
        if days_inactive >= 2:
            tasks.append({
                "type": "nudge",
                "title": "Keep your streak going",
                "description": f"You haven't practiced in {days_inactive} days — 10 questions today keeps you sharp.",
                "cta_label": "Practice Now",
                "cta_href": "/student/adaptive",
                "estimated_minutes": 10,
                "skill_id": None,
                "skill_name": None,
            })

    return {"tasks": tasks[:5]}
