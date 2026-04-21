"""
Shared helper for building assessment results responses.

Used by: assess.py (intake full-results), diagnostic.py, and future practice tests.
Extracts the duplicated question-review + skill-stats logic into one place.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.taxonomy import Skill, Domain
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse
from app.models.lesson import Lesson


def build_results_payload(
    db: Session,
    session: TestSession,
    intake_results: Dict[str, Any],
    result_type: str = "intake",
) -> Dict[str, Any]:
    """
    Build the full results payload for any completed test session.

    Args:
        db: Database session
        session: Completed TestSession
        intake_results: Output from calculate_intake_results()
        result_type: "intake" | "diagnostic" | "practice_test"

    Returns:
        Dict matching the AssessmentResultsPage data contract
    """
    test_questions = (
        db.query(TestQuestion)
        .filter(TestQuestion.test_session_id == session.id)
        .order_by(TestQuestion.question_order)
        .all()
    )

    responses = (
        db.query(StudentResponse)
        .filter(StudentResponse.test_session_id == session.id)
        .all()
    )
    response_map = {str(r.question_id): r for r in responses}

    # Caches to avoid N+1 queries
    _skill_cache: Dict[int, Optional[Skill]] = {}
    _domain_cache: Dict[int, Optional[Domain]] = {}

    def get_skill(skill_id: int) -> Optional[Skill]:
        if skill_id not in _skill_cache:
            _skill_cache[skill_id] = db.query(Skill).filter(Skill.id == skill_id).first()
        return _skill_cache[skill_id]

    def get_domain(domain_id: int) -> Optional[Domain]:
        if domain_id not in _domain_cache:
            _domain_cache[domain_id] = db.query(Domain).filter(Domain.id == domain_id).first()
        return _domain_cache[domain_id]

    skill_stats: Dict[int, Dict[str, Any]] = {}
    questions_review: List[Dict[str, Any]] = []

    for tq in test_questions:
        q = db.query(Question).filter(Question.id == tq.question_id).first()
        if not q:
            continue
        response = response_map.get(str(q.id))

        skill_name = None
        domain_name = None
        domain_code = None
        domain_section = None
        skill_id = q.skill_id

        if skill_id:
            skill = get_skill(skill_id)
            if skill:
                skill_name = skill.name
        if q.domain_id:
            domain = get_domain(q.domain_id)
            if domain:
                domain_name = domain.name
                domain_code = domain.code
                domain_section = domain.subject_area.value if domain.subject_area else None

        # Accumulate skill stats
        if skill_id:
            if skill_id not in skill_stats:
                skill_stats[skill_id] = {
                    "correct": 0,
                    "total": 0,
                    "skill_name": skill_name,
                    "domain_code": domain_code,
                    "section": domain_section,
                }
            skill_stats[skill_id]["total"] += 1
            if response and response.is_correct:
                skill_stats[skill_id]["correct"] += 1

        # Build question prompt with passage handling
        prompt = q.prompt_html
        passage_html = None
        if q.raw_import_json and isinstance(q.raw_import_json, dict):
            stimulus = q.raw_import_json.get("stimulus_html")
            raw_prompt = q.raw_import_json.get("prompt_html")
            if stimulus:
                if q.subject_area and q.subject_area.value == "reading_writing":
                    passage_html = stimulus
                    if raw_prompt:
                        prompt = raw_prompt
                else:
                    if stimulus not in prompt:
                        prompt = f"{stimulus}\n\n{prompt}"

        choices = None
        if q.choices_json:
            choices = [
                {"index": i, "content": c if isinstance(c, str) else c.get("content", "")}
                for i, c in enumerate(q.choices_json)
            ]

        explanation = q.explanation_html
        if not explanation and q.raw_import_json:
            explanation = q.raw_import_json.get("rationale_html")

        questions_review.append({
            "order": tq.question_order,
            "question_id": str(q.id),
            "prompt_html": prompt,
            "passage_html": passage_html,
            "answer_type": q.answer_type.value,
            "choices": choices,
            "student_answer": response.response_json if response else None,
            "correct_answer": q.correct_answer_json,
            "is_correct": response.is_correct if response else False,
            "explanation_html": explanation,
            "skill_name": skill_name,
            "domain_name": domain_name,
            "domain_code": domain_code,
            "time_spent_seconds": response.time_spent_seconds if response else 0,
        })

    # --- Build skill list with lesson lookup ---
    skill_ids = list(skill_stats.keys())
    lessons_by_skill: Dict[int, Lesson] = {}
    if skill_ids:
        lessons = (
            db.query(Lesson)
            .filter(Lesson.skill_id.in_(skill_ids), Lesson.status == "published")
            .all()
        )
        for lesson in lessons:
            lessons_by_skill[lesson.skill_id] = lesson

    all_skills: List[Dict[str, Any]] = []
    for skill_id, stats in skill_stats.items():
        accuracy = (stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0
        lesson = lessons_by_skill.get(skill_id)
        all_skills.append({
            "skill_id": skill_id,
            "skill_name": stats["skill_name"],
            "domain_code": stats["domain_code"],
            "section": stats["section"],
            "correct": stats["correct"],
            "total": stats["total"],
            "accuracy": round(accuracy, 1),
            "lesson_id": str(lesson.id) if lesson else None,
            "lesson_title": lesson.title if lesson else None,
        })

    # Sort by accuracy ascending (weakest first)
    all_skills.sort(key=lambda x: (x["accuracy"], -x["total"]))
    worst_skills = all_skills[:5]

    # --- Section-level accuracy ---
    sections = intake_results.get("section_abilities", [])
    section_accuracy = []
    for s in sections:
        section_accuracy.append({
            "section": s["section"],
            "correct": s["correct"],
            "total": s["total"],
            "accuracy": s["accuracy"],
        })

    # --- Domain breakdown ---
    domain_breakdown = [
        {
            "domain_id": d["domain_id"],
            "domain_code": d["domain_code"],
            "domain_name": d["domain_name"],
            "section": d["section"],
            "correct": d["correct"],
            "total": d["total"],
            "accuracy": d["accuracy"],
        }
        for d in intake_results.get("domain_abilities", [])
    ]

    return {
        "type": result_type,
        "session_id": str(session.id),
        "questions_answered": session.total_questions or 0,
        "questions_correct": session.questions_correct or 0,
        "time_seconds": session.time_spent_seconds or 0,
        "section_accuracy": section_accuracy,
        "domain_breakdown": domain_breakdown,
        "all_skills": all_skills,
        "worst_skills": worst_skills,
        "questions": questions_review,
    }
