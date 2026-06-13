"""
Roster stats: list_students computes per-student totals/accuracy via grouped
aggregate queries (no N+1) and supports server-side name/email search. Calls the
endpoint function directly (the repo's TestClient is unusable under its pin).
"""
import uuid
from app.api.v1.tutor import list_students
from app.models.user import User
from app.models.enums import UserRole, SubjectArea, AnswerType
from app.models.question import Question
from app.models.response import StudentResponse
from app.core.security import get_password_hash
from datetime import datetime, timezone


def _student(db, tutor_id, fn, ln, email):
    u = User(id=uuid.uuid4(), email=email, password_hash=get_password_hash("TestPass123"),
             first_name=fn, last_name=ln, role=UserRole.STUDENT, is_active=True,
             is_verified=True, profile_data={}, tutor_id=tutor_id)
    db.add(u); db.flush(); return u


def _q(db):
    q = Question(external_id=f"ext-{uuid.uuid4().hex[:8]}", subject_area=SubjectArea.MATH,
                 answer_type=AnswerType.MCQ, prompt_html="<p>x</p>", correct_answer_json={"c":"B"})
    db.add(q); db.flush(); return q


def _resp(db, student_id, q_id, correct):
    db.add(StudentResponse(student_id=student_id, question_id=q_id, is_correct=correct,
                           response_json={"c":"B"}, submitted_at=datetime.now(timezone.utc)))


def test_roster_aggregates(db, test_tutor):
    a = _student(db, test_tutor.id, "Alice", "Anders", "alice@t.com")
    b = _student(db, test_tutor.id, "Bob", "Brown", "bob@t.com")
    q1, q2 = _q(db), _q(db)
    # Alice: 3 answered, 2 correct
    _resp(db, a.id, q1.id, True); _resp(db, a.id, q2.id, True); _resp(db, a.id, q1.id, False)
    # Bob: 1 answered, 0 correct
    _resp(db, b.id, q2.id, False)
    db.commit()

    res = list_students(db=db, current_user=test_tutor, search=None)
    by_name = {i.first_name: i for i in res.items}
    assert res.total == 2
    assert by_name["Alice"].total_questions_answered == 3
    assert by_name["Alice"].overall_accuracy == 66.7  # 2/3
    assert by_name["Bob"].total_questions_answered == 1
    assert by_name["Bob"].overall_accuracy == 0.0

    # search by name
    r2 = list_students(db=db, current_user=test_tutor, search="alic")
    assert r2.total == 1 and r2.items[0].first_name == "Alice"
    # search by email
    r3 = list_students(db=db, current_user=test_tutor, search="bob@")
    assert r3.total == 1 and r3.items[0].first_name == "Bob"
