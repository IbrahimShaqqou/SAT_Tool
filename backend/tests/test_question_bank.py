"""
Tests for the redesigned Question Bank: filters, persistent attempts (as
session-less StudentResponse with a source marker), bookmarks, wrong-answer
review, stats, and auth scoping.

Direct service/endpoint-function calls (HTTP TestClient unusable under repo pin).
"""

import uuid

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.models.enums import UserRole, SubjectArea, AnswerType, DifficultyLevel
from app.models.taxonomy import Domain, Skill
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.question_bookmark import QuestionBookmark
from app.core.security import get_password_hash
from app.services import question_bank_service as qbank
from app.api.v1 import questions as qapi


def _domain(db):
    d = Domain(name="Algebra", subject_area=SubjectArea.MATH, code=f"D{uuid.uuid4().hex[:4]}")
    db.add(d); db.flush(); return d


def _skill(db, domain):
    s = Skill(name="Linear eq", domain_id=domain.id, code=f"S{uuid.uuid4().hex[:4]}")
    db.add(s); db.flush(); return s


def _q(db, skill, domain, band=DifficultyLevel.MEDIUM, *, prompt="<p>2+2?</p>", correct_index=1):
    q = Question(
        external_id=f"ext-{uuid.uuid4().hex[:8]}", subject_area=SubjectArea.MATH,
        domain_id=domain.id, skill_id=skill.id, answer_type=AnswerType.MCQ,
        difficulty=band, prompt_html=prompt, choices_json=["A", "B", "C", "D"],
        correct_answer_json={"index": correct_index}, is_active=True,
    )
    db.add(q); db.flush(); return q


def _student(db, tutor_id=None):
    u = User(id=uuid.uuid4(), email=f"s-{uuid.uuid4().hex[:6]}@t.com",
             password_hash=get_password_hash("TestPass123"), first_name="S", last_name="T",
             role=UserRole.STUDENT, is_active=True, is_verified=True, profile_data={}, tutor_id=tutor_id)
    db.add(u); db.flush(); return u


# --------------------------- filters --------------------------- #
def test_filter_by_difficulty_and_skill(db):
    dom = _domain(db); sk = _skill(db, dom)
    e = _q(db, sk, dom, DifficultyLevel.EASY)
    _q(db, sk, dom, DifficultyLevel.HARD)
    student = _student(db)
    res = qbank.list_questions(db, student_id=student.id, difficulty=DifficultyLevel.EASY)
    ids = [q.id for q in res["items"]]
    assert e.id in ids and len(ids) == 1
    res2 = qbank.list_questions(db, student_id=student.id, skill_id=sk.id)
    assert res2["total"] == 2


def test_search_matches_prompt_and_external_id(db):
    dom = _domain(db); sk = _skill(db, dom)
    target = _q(db, sk, dom, prompt="<p>photosynthesis chlorophyll</p>")
    _q(db, sk, dom, prompt="<p>unrelated</p>")
    student = _student(db)
    res = qbank.list_questions(db, student_id=student.id, search="chlorophyll")
    assert [q.id for q in res["items"]] == [target.id]


# --------------------------- attempts + status --------------------------- #
def test_record_attempt_persists_sessionless_with_source(db):
    dom = _domain(db); sk = _skill(db, dom); q = _q(db, sk, dom)
    student = _student(db)
    qbank.record_attempt(db, student.id, q, {"index": 1}, True)
    db.commit()
    rows = db.query(StudentResponse).filter(StudentResponse.student_id == student.id).all()
    assert len(rows) == 1
    assert rows[0].test_session_id is None
    assert rows[0].response_json.get("_source") == "question_bank"
    assert rows[0].is_correct is True


def test_status_filters_correct_incorrect_unattempted(db):
    dom = _domain(db); sk = _skill(db, dom)
    qc = _q(db, sk, dom); qi = _q(db, sk, dom); qu = _q(db, sk, dom)
    student = _student(db)
    qbank.record_attempt(db, student.id, qc, {"index": 1}, True)
    qbank.record_attempt(db, student.id, qi, {"index": 0}, False)
    db.commit()

    correct = qbank.list_questions(db, student_id=student.id, status="correct")
    assert [q.id for q in correct["items"]] == [qc.id]
    incorrect = qbank.list_questions(db, student_id=student.id, status="incorrect")
    assert [q.id for q in incorrect["items"]] == [qi.id]
    unattempted = qbank.list_questions(db, student_id=student.id, status="unattempted")
    assert qu.id in [q.id for q in unattempted["items"]]
    assert qc.id not in [q.id for q in unattempted["items"]]


def test_attempted_status_returns_only_seen(db):
    dom = _domain(db); sk = _skill(db, dom)
    seen = _q(db, sk, dom); fresh = _q(db, sk, dom)
    student = _student(db)
    qbank.record_attempt(db, student.id, seen, {"index": 1}, True)
    db.commit()
    res = qbank.list_questions(db, student_id=student.id, status="attempted")
    ids = [q.id for q in res["items"]]
    assert seen.id in ids and fresh.id not in ids


def test_latest_attempt_wins_in_status_map(db):
    dom = _domain(db); sk = _skill(db, dom); q = _q(db, sk, dom)
    student = _student(db)
    from datetime import datetime, timezone, timedelta
    # wrong first, then correct later
    db.add(StudentResponse(student_id=student.id, question_id=q.id, is_correct=False,
                           response_json={"index": 0}, submitted_at=datetime.now(timezone.utc) - timedelta(hours=1)))
    db.add(StudentResponse(student_id=student.id, question_id=q.id, is_correct=True,
                           response_json={"index": 1}, submitted_at=datetime.now(timezone.utc)))
    db.commit()
    res = qbank.list_questions(db, student_id=student.id)
    assert res["correctness"][q.id] is True  # latest wins


# --------------------------- bookmarks --------------------------- #
def test_bookmark_add_remove_filter(db):
    dom = _domain(db); sk = _skill(db, dom); q1 = _q(db, sk, dom); q2 = _q(db, sk, dom)
    student = _student(db)
    qbank.add_bookmark(db, student.id, q1.id)
    qbank.add_bookmark(db, student.id, q1.id)  # idempotent
    db.commit()
    assert db.query(QuestionBookmark).filter(QuestionBookmark.student_id == student.id).count() == 1
    res = qbank.list_questions(db, student_id=student.id, bookmarked=True)
    assert [q.id for q in res["items"]] == [q1.id]
    assert q1.id in res["bookmarked"]
    # remove
    assert qbank.remove_bookmark(db, student.id, q1.id) is True
    db.commit()
    res2 = qbank.list_questions(db, student_id=student.id, bookmarked=True)
    assert res2["total"] == 0


# --------------------------- stats --------------------------- #
def test_my_stats(db):
    dom = _domain(db); sk = _skill(db, dom); q1 = _q(db, sk, dom); q2 = _q(db, sk, dom)
    student = _student(db)
    qbank.record_attempt(db, student.id, q1, {"index": 1}, True)
    qbank.record_attempt(db, student.id, q2, {"index": 0}, False)
    qbank.add_bookmark(db, student.id, q1.id)
    db.commit()
    stats = qbank.my_stats(db, student.id)
    assert stats["distinct_questions_attempted"] == 2
    assert stats["total_attempts"] == 2
    assert stats["correct_attempts"] == 1
    assert stats["accuracy"] == 50.0
    assert stats["bookmarks"] == 1


# --------------------------- auth scoping --------------------------- #
def test_attempts_and_bookmarks_are_per_student(db):
    dom = _domain(db); sk = _skill(db, dom); q = _q(db, sk, dom)
    a = _student(db); b = _student(db)
    qbank.record_attempt(db, a.id, q, {"index": 1}, True)
    qbank.add_bookmark(db, a.id, q.id)
    db.commit()
    # b sees no status / no bookmark
    res_b = qbank.list_questions(db, student_id=b.id)
    assert res_b["correctness"] == {}
    assert res_b["bookmarked"] == set()


# --------------------------- endpoint: attempt --------------------------- #
def test_bank_attempt_endpoint_records_and_grades(db):
    dom = _domain(db); sk = _skill(db, dom); q = _q(db, sk, dom, correct_index=2)
    student = _student(db)
    out = qapi.bank_attempt(q.id, {"answer": {"index": 2}}, db=db, current_user=student)
    assert out["is_correct"] is True
    assert db.query(StudentResponse).filter(
        StudentResponse.student_id == student.id, StudentResponse.question_id == q.id
    ).count() == 1


def test_bank_attempt_404_for_missing(db):
    student = _student(db)
    with pytest.raises(HTTPException) as ei:
        qapi.bank_attempt(uuid.uuid4(), {"answer": {"index": 0}}, db=db, current_user=student)
    assert ei.value.status_code == 404
