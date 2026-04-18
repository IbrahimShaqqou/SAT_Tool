"""
SAT Tutoring Platform - Diagnostic Assessment API

Students can self-initiate a diagnostic assessment from the dashboard.
Creates a balanced 30-question session (15 math + 15 R&W) using the
same adaptive question selection as intake assessments.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.invite import Invite, generate_invite_token
from app.models.test import TestSession, TestQuestion
from app.models.enums import TestType, TestStatus, SubjectArea, InviteStatus, AssessmentType
from app.services.intake_service import select_intake_questions, calculate_intake_results
from app.models.question import Question
from app.models.taxonomy import Skill, Domain
from app.models.response import StudentResponse
from app.models.lesson import Lesson

router = APIRouter()

DIAGNOSTIC_MATH_QUESTIONS = 15
DIAGNOSTIC_RW_QUESTIONS = 15


@router.post("/start")
def start_diagnostic(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start a self-serve diagnostic assessment.

    Selects 15 math + 15 R&W questions balanced across skills,
    creates a TestSession and an Invite token for the assess flow.
    Returns { token } for navigating to /assess/{token}.
    """
    # Check for an existing incomplete diagnostic
    existing = (
        db.query(TestSession)
        .filter(
            and_(
                TestSession.student_id == current_user.id,
                TestSession.test_type == TestType.DIAGNOSTIC,
                TestSession.status == TestStatus.IN_PROGRESS,
            )
        )
        .order_by(TestSession.created_at.desc())
        .first()
    )
    if existing:
        # Find the invite for this session
        invite = db.query(Invite).filter(Invite.test_session_id == existing.id).first()
        if invite:
            return {"token": invite.token, "session_id": str(existing.id), "is_resuming": True}

    # Select questions from both sections
    math_questions = select_intake_questions(
        db=db,
        question_count=DIAGNOSTIC_MATH_QUESTIONS,
        subject_area=SubjectArea.MATH,
    )
    rw_questions = select_intake_questions(
        db=db,
        question_count=DIAGNOSTIC_RW_QUESTIONS,
        subject_area=SubjectArea.READING_WRITING,
    )

    if not math_questions and not rw_questions:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No questions available for diagnostic",
        )

    # Interleave math and R&W questions for a natural mix
    all_questions = []
    math_iter = iter(math_questions)
    rw_iter = iter(rw_questions)
    while True:
        try:
            all_questions.append(next(math_iter))
        except StopIteration:
            pass
        try:
            all_questions.append(next(rw_iter))
        except StopIteration:
            pass
        if len(all_questions) >= len(math_questions) + len(rw_questions):
            break

    total = len(all_questions)

    # Create the test session
    session = TestSession(
        student_id=current_user.id,
        test_type=TestType.DIAGNOSTIC,
        status=TestStatus.IN_PROGRESS,
        subject_area=None,  # covers both
        title="Diagnostic Assessment",
        total_questions=total,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()

    # Create TestQuestion records
    for i, q in enumerate(all_questions):
        db.add(TestQuestion(
            test_session_id=session.id,
            question_id=q.id,
            question_order=i,
        ))

    # Create an Invite so the existing assess flow can handle the test UI
    # tutor_id = student's own ID (self-serve diagnostic)
    invite = Invite(
        token=generate_invite_token(),
        tutor_id=current_user.id,
        student_id=current_user.id,
        title="Diagnostic Assessment",
        subject_area=None,
        question_count=total,
        is_adaptive=False,  # Questions already selected
        assessment_type=AssessmentType.INTAKE,
        status=InviteStatus.USED,  # Pre-used so the start endpoint skips re-selection
        test_session_id=session.id,
    )
    db.add(invite)
    db.commit()

    return {
        "token": invite.token,
        "session_id": str(session.id),
        "is_resuming": False,
        "total_questions": total,
    }


@router.get("/{session_id}/results")
def get_diagnostic_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get full results for a completed diagnostic session.
    Same format as GET /assess/{token}/full-results.
    """
    from uuid import UUID

    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = db.query(TestSession).filter(
        TestSession.id == sid,
        TestSession.student_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != TestStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Diagnostic has not been completed yet")

    # Use the same calculation as the intake full-results
    results = calculate_intake_results(db, session.id)
    if "error" in results:
        raise HTTPException(status_code=500, detail=results["error"])

    # Build question review + skill stats
    test_questions = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id
    ).order_by(TestQuestion.question_order).all()

    responses = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session.id
    ).all()
    response_map = {str(r.question_id): r for r in responses}

    skill_stats: dict = {}
    questions_review = []

    for tq in test_questions:
        q = db.query(Question).filter(Question.id == tq.question_id).first()
        if not q:
            continue
        response = response_map.get(str(q.id))

        skill_name = None
        domain_name = None
        domain_code = None
        skill_id = q.skill_id

        if skill_id:
            skill = db.query(Skill).filter(Skill.id == skill_id).first()
            if skill:
                skill_name = skill.name
        if q.domain_id:
            domain = db.query(Domain).filter(Domain.id == q.domain_id).first()
            if domain:
                domain_name = domain.name
                domain_code = domain.code

        if skill_id:
            if skill_id not in skill_stats:
                skill_stats[skill_id] = {"correct": 0, "total": 0, "skill_name": skill_name, "domain_code": domain_code}
            skill_stats[skill_id]["total"] += 1
            if response and response.is_correct:
                skill_stats[skill_id]["correct"] += 1

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

    # Worst skills with lesson lookup
    skill_ids = list(skill_stats.keys())
    lessons_by_skill: dict = {}
    if skill_ids:
        lessons = db.query(Lesson).filter(
            Lesson.skill_id.in_(skill_ids),
            Lesson.status == "published",
        ).all()
        for lesson in lessons:
            lessons_by_skill[lesson.skill_id] = lesson

    worst_skills = []
    for skill_id, stats in skill_stats.items():
        accuracy = (stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0
        lesson = lessons_by_skill.get(skill_id)
        worst_skills.append({
            "skill_id": skill_id,
            "skill_name": stats["skill_name"],
            "domain_code": stats["domain_code"],
            "correct": stats["correct"],
            "total": stats["total"],
            "accuracy": round(accuracy, 1),
            "lesson_id": str(lesson.id) if lesson else None,
            "lesson_title": lesson.title if lesson else None,
        })

    worst_skills.sort(key=lambda x: (x["accuracy"], -x["total"]))
    worst_skills = worst_skills[:5]

    composite = results.get("predicted_composite")

    return {
        "type": "diagnostic",
        "session_id": str(session.id),
        "questions_answered": session.total_questions or 0,
        "questions_correct": session.questions_correct or 0,
        "time_seconds": session.time_spent_seconds or 0,
        "score": {
            "total": composite["mid"] if composite else None,
            "range_low": composite["low"] if composite else None,
            "range_high": composite["high"] if composite else None,
            "math": next((s["predicted_score_mid"] for s in results.get("section_abilities", []) if s["section"] == "math"), None),
            "math_low": next((s["predicted_score_low"] for s in results.get("section_abilities", []) if s["section"] == "math"), None),
            "math_high": next((s["predicted_score_high"] for s in results.get("section_abilities", []) if s["section"] == "math"), None),
            "reading_writing": next((s["predicted_score_mid"] for s in results.get("section_abilities", []) if s["section"] == "reading_writing"), None),
            "rw_low": next((s["predicted_score_low"] for s in results.get("section_abilities", []) if s["section"] == "reading_writing"), None),
            "rw_high": next((s["predicted_score_high"] for s in results.get("section_abilities", []) if s["section"] == "reading_writing"), None),
        },
        "sections": results.get("section_abilities", []),
        "domain_breakdown": [
            {
                "domain_id": d["domain_id"],
                "domain_code": d["domain_code"],
                "domain_name": d["domain_name"],
                "section": d["section"],
                "correct": d["correct"],
                "total": d["total"],
                "accuracy": d["accuracy"],
            }
            for d in results.get("domain_abilities", [])
        ],
        "worst_skills": worst_skills,
        "questions": questions_review,
    }
