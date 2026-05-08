"""
Tests for intake_service.calculate_intake_results — skill_breakdown aggregation.
"""
import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession
from app.models.response import StudentResponse
from app.models.user import User
from app.models.lesson import Lesson
from app.models.enums import (
    AnswerType, DifficultyLevel, SubjectArea, TestType, TestStatus, UserRole,
)
from app.services.intake_service import calculate_intake_results


@pytest.fixture
def student(db: Session) -> User:
    user = User(
        id=uuid4(),
        email=f"student-{uuid4().hex[:8]}@test.com",
        password_hash="x",
        role=UserRole.STUDENT,
        first_name="Test",
        last_name="Student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def algebra_domain(db: Session) -> Domain:
    d = Domain(
        code="H",
        name="Algebra",
        subject_area=SubjectArea.MATH,
        description="Algebra",
        display_order=1,
        is_active=True,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@pytest.fixture
def linear_skill(db: Session, algebra_domain: Domain) -> Skill:
    s = Skill(
        domain_id=algebra_domain.id,
        code="H.A",
        name="Linear equations",
        description="x",
        display_order=1,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def systems_skill(db: Session, algebra_domain: Domain) -> Skill:
    s = Skill(
        domain_id=algebra_domain.id,
        code="H.B",
        name="Systems of equations",
        description="x",
        display_order=2,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _make_question(db, domain, skill, ext_id):
    q = Question(
        id=uuid4(),
        external_id=ext_id,
        subject_area=SubjectArea.MATH,
        domain_id=domain.id,
        skill_id=skill.id,
        answer_type=AnswerType.MCQ,
        difficulty=DifficultyLevel.MEDIUM,
        prompt_html="<p>q</p>",
        choices_json=["<p>a</p>", "<p>b</p>"],
        correct_answer_json={"index": 0},
        is_active=True,
        is_verified=True,
        irt_discrimination_a=1.0,
        irt_difficulty_b=0.0,
        irt_guessing_c=0.25,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


def _make_session(db, student) -> TestSession:
    s = TestSession(
        id=uuid4(),
        student_id=student.id,
        test_type=TestType.DIAGNOSTIC,
        status=TestStatus.COMPLETED,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _record_response(db, session, question, is_correct):
    r = StudentResponse(
        id=uuid4(),
        student_id=session.student_id,
        test_session_id=session.id,
        question_id=question.id,
        response_json={"index": 0 if is_correct else 1},
        is_correct=is_correct,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(r)
    db.commit()
    return r


def test_skill_breakdown_groups_responses_by_skill(
    db, student, algebra_domain, linear_skill, systems_skill
):
    """Two skills under the same domain are reported separately with correct counts."""
    session = _make_session(db, student)

    q1 = _make_question(db, algebra_domain, linear_skill, "q1")
    q2 = _make_question(db, algebra_domain, linear_skill, "q2")
    q3 = _make_question(db, algebra_domain, systems_skill, "q3")

    _record_response(db, session, q1, is_correct=True)
    _record_response(db, session, q2, is_correct=False)
    _record_response(db, session, q3, is_correct=True)

    results = calculate_intake_results(db, session.id)

    assert "skill_breakdown" in results
    by_skill = {row["skill_id"]: row for row in results["skill_breakdown"]}

    assert by_skill[linear_skill.id]["correct"] == 1
    assert by_skill[linear_skill.id]["total"] == 2
    assert by_skill[linear_skill.id]["accuracy"] == 50.0
    assert by_skill[linear_skill.id]["skill_name"] == "Linear equations"
    assert by_skill[linear_skill.id]["domain_code"] == "H"
    assert by_skill[linear_skill.id]["domain_name"] == "Algebra"

    assert by_skill[systems_skill.id]["correct"] == 1
    assert by_skill[systems_skill.id]["total"] == 1
    assert by_skill[systems_skill.id]["accuracy"] == 100.0


def test_skill_breakdown_includes_lesson_id_when_lesson_exists(
    db, student, algebra_domain, linear_skill, systems_skill
):
    """skill_breakdown attaches lesson_id only for skills with an active lesson."""
    session = _make_session(db, student)

    q1 = _make_question(db, algebra_domain, linear_skill, "q1")
    q2 = _make_question(db, algebra_domain, systems_skill, "q2")

    lesson = Lesson(
        id=uuid4(),
        skill_id=linear_skill.id,
        domain_id=algebra_domain.id,
        title="Linear Equations Lesson",
        is_active=True,
    )
    db.add(lesson)
    db.commit()

    _record_response(db, session, q1, is_correct=True)
    _record_response(db, session, q2, is_correct=True)

    results = calculate_intake_results(db, session.id)
    by_skill = {row["skill_id"]: row for row in results["skill_breakdown"]}

    assert by_skill[linear_skill.id]["lesson_id"] == lesson.id
    assert by_skill[systems_skill.id]["lesson_id"] is None


def test_skill_breakdown_omits_skills_with_zero_attempts(
    db, student, algebra_domain, linear_skill, systems_skill
):
    """Skills the student never saw do not appear."""
    session = _make_session(db, student)
    q = _make_question(db, algebra_domain, linear_skill, "q1")
    _record_response(db, session, q, is_correct=True)

    results = calculate_intake_results(db, session.id)
    skill_ids = {row["skill_id"] for row in results["skill_breakdown"]}

    assert linear_skill.id in skill_ids
    assert systems_skill.id not in skill_ids
