"""Tests for the assignment-start -> live-session bridge.

The start endpoint must expose the created TestSession's id so the
frontend TestPage can join a live tutoring room.
"""

from datetime import datetime, timezone
from uuid import uuid4

from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.enums import (
    UserRole,
    AssignmentStatus,
    AnswerType,
    SubjectArea,
)
from app.models.question import Question
from app.models.assignment import Assignment, AssignmentQuestion


def _mk_user(db, role, tutor_id=None):
    user = User(
        id=uuid4(),
        email=f"{uuid4().hex[:8]}@ex.com",
        password_hash=get_password_hash("Passw0rd!"),
        first_name="X",
        last_name="Y",
        role=role,
        is_active=True,
        tutor_id=tutor_id,
    )
    db.add(user)
    db.commit()
    return user


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}


def _mk_question(db):
    q = Question(
        id=uuid4(),
        external_id=f"q-{uuid4().hex[:8]}",
        subject_area=SubjectArea.MATH,
        prompt_html="<p>What is 2+2?</p>",
        choices_json=["3", "4", "5", "6"],
        answer_type=AnswerType.MCQ,
        correct_answer_json={"index": 1},
        is_active=True,
    )
    db.add(q)
    db.commit()
    return q


def _mk_assignment(db, tutor, student, question):
    assignment = Assignment(
        id=uuid4(),
        tutor_id=tutor.id,
        student_id=student.id,
        title="Live bridge assignment",
        status=AssignmentStatus.PENDING,
        assigned_at=datetime.now(timezone.utc),
        question_count=1,
        question_config={"subject": "math"},
        is_adaptive=False,
    )
    db.add(assignment)
    db.flush()
    db.add(
        AssignmentQuestion(
            id=uuid4(),
            assignment_id=assignment.id,
            question_id=question.id,
            question_order=1,
        )
    )
    db.commit()
    return assignment


def test_start_assignment_returns_test_session_id(client, db):
    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    question = _mk_question(db)
    assignment = _mk_assignment(db, tutor, student, question)

    r = client.post(
        f"/api/v1/assignments/{assignment.id}/start",
        headers=_auth(student),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("test_session_id"), (
        f"start response missing test_session_id: {body}"
    )


def test_get_assignment_returns_test_session_id_on_resume(client, db):
    """Resuming an in-progress assignment must expose the linked TestSession id
    via the detail endpoint so the frontend can re-activate live tutoring."""
    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    question = _mk_question(db)
    assignment = _mk_assignment(db, tutor, student, question)

    # Start the assignment to create the linked TestSession.
    start = client.post(
        f"/api/v1/assignments/{assignment.id}/start",
        headers=_auth(student),
    )
    assert start.status_code == 200, start.text
    started_session_id = start.json()["test_session_id"]

    # Simulate a page reload / resume: GET the detail endpoint.
    detail = client.get(
        f"/api/v1/assignments/{assignment.id}",
        headers=_auth(student),
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body.get("test_session_id"), (
        f"detail response missing test_session_id: {body}"
    )
    assert body["test_session_id"] == started_session_id
