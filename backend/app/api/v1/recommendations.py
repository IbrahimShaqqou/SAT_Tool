"""
SAT Tutoring Platform - Study Recommendations API

Generates a personalized study plan for students based on
diagnostic results, skill mastery, lesson progress, and activity.
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.response import StudentSkill
from app.models.lesson import Lesson, LessonCompletion
from app.models.taxonomy import Skill, Domain
from app.models.enums import SubjectArea
from app.services.irt_service import MasteryLevel, get_effective_mastery_level

router = APIRouter()


def _build_study_plan_tasks(db: Session, user: User):
    """
    Build the ordered task list for the student's study plan.

    Priority:
    1. Stale skills — mastery is fading, needs review
    2. Near level-up — close to reaching next mastery level
    3. Lessons for weak skills — learn before practice
    4. Weak skills needing practice — low mastery, no lesson or lesson done
    5. Unpracticed skills with lessons — haven't started yet
    6. Daily nudge — if nothing else or inactive
    """
    now = datetime.now(timezone.utc)
    tasks = []

    # ── Gather all student skill records ──
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == user.id,
    ).all()
    skill_record_map = {sr.skill_id: sr for sr in skill_records}

    # ── Preload all skills, domains, lessons ──
    all_skills = db.query(Skill).filter(Skill.is_active == True).all()
    domain_map = {}
    for d in db.query(Domain).filter(Domain.is_active == True).all():
        domain_map[d.id] = d

    all_lessons = db.query(Lesson).filter(Lesson.status == "published").all()
    lesson_by_skill = {l.skill_id: l for l in all_lessons}

    completed_lesson_ids = set()
    if all_lessons:
        comps = db.query(LessonCompletion).filter(
            LessonCompletion.student_id == user.id,
        ).all()
        completed_lesson_ids = {c.lesson_id for c in comps}

    # ── Categorize skills ──
    stale_skills = []
    near_levelup_skills = []
    weak_skills = []           # practiced but low mastery
    unpracticed_skills = []    # never practiced

    for skill in all_skills:
        domain = domain_map.get(skill.domain_id)
        if not domain:
            continue

        sr = skill_record_map.get(skill.id)
        lesson = lesson_by_skill.get(skill.id)
        lesson_done = lesson and lesson.id in completed_lesson_ids

        info = {
            "skill": skill,
            "domain": domain,
            "lesson": lesson,
            "lesson_done": lesson_done,
            "sr": sr,
        }

        if not sr or sr.questions_attempted == 0:
            unpracticed_skills.append(info)
            continue

        stored_level = MasteryLevel(sr.mastery_level_enum) if sr.mastery_level_enum is not None else MasteryLevel.NOT_STARTED
        effective_level, is_stale = get_effective_mastery_level(stored_level, sr.last_practiced_at)
        info["effective_level"] = effective_level
        info["is_stale"] = is_stale
        info["theta"] = sr.ability_theta or 0
        info["accuracy"] = (sr.questions_correct / sr.questions_attempted * 100) if sr.questions_attempted else 0

        if is_stale:
            stale_skills.append(info)
        elif effective_level == MasteryLevel.FAMILIAR:
            # Check if near level-up
            total = sr.questions_attempted or 0
            medium_total = sr.medium_questions_total or 0
            medium_correct = sr.medium_questions_correct or 0
            medium_acc = (medium_correct / medium_total * 100) if medium_total > 0 else 0
            theta = sr.ability_theta or 0
            reqs = [total >= 5, medium_acc >= 70 and medium_total >= 3, theta >= 0]
            progress_pct = sum(reqs) / len(reqs) * 100
            info["progress_pct"] = progress_pct
            if progress_pct >= 33:
                near_levelup_skills.append(info)
            else:
                weak_skills.append(info)
        elif effective_level == MasteryLevel.NOT_STARTED:
            weak_skills.append(info)

    # Sort each category
    stale_skills.sort(key=lambda x: x["theta"])  # weakest first
    near_levelup_skills.sort(key=lambda x: -x.get("progress_pct", 0))  # closest to leveling up first
    weak_skills.sort(key=lambda x: x["theta"])
    unpracticed_skills.sort(key=lambda x: (x["domain"].subject_area.value, x["domain"].display_order, skill.display_order or 0))

    # ── Build task list ──

    # 1. Stale skills — review
    for info in stale_skills:
        skill, domain = info["skill"], info["domain"]
        tasks.append({
            "type": "review",
            "title": f"Review: {skill.name}",
            "description": f"Your mastery is fading — practice to keep it fresh.",
            "section": domain.subject_area.value,
            "domain_code": domain.code,
            "skill_id": skill.id,
            "skill_name": skill.name,
            "actions": [
                {"label": "Practice", "href": f"/student/adaptive?skill={skill.id}&autostart=true", "variant": "primary"},
            ],
            "estimated_minutes": 10,
            "priority": 1,
        })

    # 2. Near level-up — practice to reach next level
    for info in near_levelup_skills:
        skill, domain = info["skill"], info["domain"]
        pct = int(info.get("progress_pct", 50))
        tasks.append({
            "type": "level_up",
            "title": f"Level up: {skill.name}",
            "description": f"You're {pct}% of the way to Proficient — keep going!",
            "section": domain.subject_area.value,
            "domain_code": domain.code,
            "skill_id": skill.id,
            "skill_name": skill.name,
            "actions": [
                {"label": "Practice", "href": f"/student/adaptive?skill={skill.id}&autostart=true", "variant": "primary"},
            ],
            "estimated_minutes": 15,
            "priority": 2,
        })

    # 3 & 4. Weak skills — lesson first, then practice
    for info in weak_skills:
        skill, domain = info["skill"], info["domain"]
        lesson = info["lesson"]
        lesson_done = info["lesson_done"]

        actions = []
        if lesson and not lesson_done:
            actions.append({"label": "Study Lesson", "href": f"/student/lessons/{lesson.id}", "variant": "primary"})
            actions.append({"label": "Practice", "href": f"/student/adaptive?skill={skill.id}&autostart=true", "variant": "secondary"})
            task_type = "lesson_then_practice"
            desc = "Start with the lesson, then practice to build mastery."
        else:
            actions.append({"label": "Practice", "href": f"/student/adaptive?skill={skill.id}&autostart=true", "variant": "primary"})
            task_type = "practice"
            desc = "Practice to improve your mastery." if lesson_done else "Practice to build familiarity."

        tasks.append({
            "type": task_type,
            "title": f"Improve: {skill.name}",
            "description": desc,
            "section": domain.subject_area.value,
            "domain_code": domain.code,
            "skill_id": skill.id,
            "skill_name": skill.name,
            "actions": actions,
            "estimated_minutes": 15 if lesson and not lesson_done else 10,
            "priority": 3,
        })

    # 5. Unpracticed skills with lessons — start learning
    for info in unpracticed_skills:
        skill, domain = info["skill"], info["domain"]
        lesson = info["lesson"]
        lesson_done = info["lesson_done"]

        actions = []
        if lesson and not lesson_done:
            actions.append({"label": "Study Lesson", "href": f"/student/lessons/{lesson.id}", "variant": "primary"})
            actions.append({"label": "Practice", "href": f"/student/adaptive?skill={skill.id}&autostart=true", "variant": "secondary"})
            desc = "New skill — start with the lesson."
        else:
            actions.append({"label": "Practice", "href": f"/student/adaptive?skill={skill.id}&autostart=true", "variant": "primary"})
            desc = "New skill — jump into practice."

        tasks.append({
            "type": "new_skill",
            "title": f"Learn: {skill.name}",
            "description": desc,
            "section": domain.subject_area.value,
            "domain_code": domain.code,
            "skill_id": skill.id,
            "skill_name": skill.name,
            "actions": actions,
            "estimated_minutes": 15 if lesson and not lesson_done else 10,
            "priority": 4,
        })

    return tasks


@router.get("/study-plan")
def get_study_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a personalized study plan.

    Returns all tasks ordered by priority. The frontend decides
    how many to show (dashboard widget vs. full plan page).
    """
    tasks = _build_study_plan_tasks(db, current_user)

    # Summary stats
    math_count = len([t for t in tasks if t["section"] == "math"])
    rw_count = len([t for t in tasks if t["section"] == "reading_writing"])
    review_count = len([t for t in tasks if t["type"] == "review"])
    lesson_count = len([t for t in tasks if "lesson" in (t.get("type") or "")])

    return {
        "tasks": tasks,
        "summary": {
            "total_tasks": len(tasks),
            "math_tasks": math_count,
            "rw_tasks": rw_count,
            "review_tasks": review_count,
            "lesson_tasks": lesson_count,
        },
    }
