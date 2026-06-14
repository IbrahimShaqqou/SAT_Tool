"""
Tests for the forgetting loop (Leitner spaced repetition, test-date clamped).

Direct service calls (HTTP TestClient unusable under repo pin).
"""

import uuid
from datetime import datetime, timezone, timedelta

from app.models.user import User
from app.models.enums import (
    UserRole, SubjectArea, AnswerType, DifficultyLevel, WorklistStatus, MasteryCheckKind,
)
from app.models.taxonomy import Domain, Skill
from app.models.question import Question
from app.models.worklist import WorklistItem
from app.core.security import get_password_hash
from app.services import forgetting_service as fl
from app.services import mastery_check_service as mc


def _student(db, days_to_test=None):
    u = User(id=uuid.uuid4(), email=f"s-{uuid.uuid4().hex[:6]}@t.com",
             password_hash=get_password_hash("TestPass123"), first_name="S", last_name="T",
             role=UserRole.STUDENT, is_active=True, is_verified=True, profile_data={})
    if days_to_test is not None:
        u.test_date = (datetime.now(timezone.utc) + timedelta(days=days_to_test)).date()
    db.add(u); db.flush(); return u


def _dom_skill(db):
    d = Domain(name="Algebra", subject_area=SubjectArea.MATH, code=f"D{uuid.uuid4().hex[:3]}")
    db.add(d); db.flush()
    s = Skill(name="Linear eq", domain_id=d.id, code=f"S{uuid.uuid4().hex[:3]}")
    db.add(s); db.flush()
    return d, s


def _pool(db, skill, domain, per_band=4):
    for band in (DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD):
        for _ in range(per_band):
            db.add(Question(external_id=f"ext-{uuid.uuid4().hex[:8]}", subject_area=SubjectArea.MATH,
                            domain_id=domain.id, skill_id=skill.id, answer_type=AnswerType.MCQ,
                            difficulty=band, prompt_html="x", choices_json=["A", "B"],
                            correct_answer_json={"index": 0}, is_active=True))
    db.flush()


def _item(db, student, skill, status=WorklistStatus.DONE):
    it = WorklistItem(student_id=student.id, skill_id=skill.id, status=status,
                      position=0, source="auto")
    db.add(it); db.flush(); return it


# --------------------------- scheduling --------------------------- #
def test_first_master_schedules_box1(db):
    student = _student(db)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk)
    fl.schedule_review(db, item, promote=False, student=student)
    assert item.box == 1
    assert item.review_due_at is not None
    # box 1 → 2 days out (no test date)
    delta = (item.review_due_at - datetime.now(timezone.utc)).days
    assert delta in (1, 2)  # allow for clock rounding


def test_promotion_lengthens_interval(db):
    student = _student(db)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk)
    fl.schedule_review(db, item, promote=False, student=student)  # box1 → 2d
    first = item.review_due_at
    fl.schedule_review(db, item, promote=True, student=student)   # box2 → 4d
    assert item.box == 2
    assert item.review_due_at > first


def test_box_caps_at_max(db):
    student = _student(db)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk)
    for _ in range(fl.MAX_BOX + 3):
        fl.schedule_review(db, item, promote=True, student=student)
    assert item.box == fl.MAX_BOX


# --------------------------- test-date clamp --------------------------- #
def test_interval_clamped_before_test(db):
    # Test is 5 days out; a box-3 (7-day) interval must be pulled to before the test.
    student = _student(db, days_to_test=5)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk)
    item.box = 2  # next promote → box 3 (7 days, exceeds the 5-day horizon)
    fl.schedule_review(db, item, promote=True, student=student)
    days_out = (item.review_due_at - datetime.now(timezone.utc)).days
    assert days_out < 5  # never on/after test day
    assert item.review_due_at is not None


def test_no_schedule_when_test_passed(db):
    student = _student(db, days_to_test=0)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk)
    fl.schedule_review(db, item, promote=False, student=student)
    assert item.review_due_at is None


# --------------------------- resurface --------------------------- #
def test_resurface_flips_due_done_to_refresh(db):
    student = _student(db)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk, status=WorklistStatus.DONE)
    item.review_due_at = datetime.now(timezone.utc) - timedelta(hours=1)  # overdue
    db.flush()
    n = fl.resurface_due(db, student.id)
    assert n == 1
    assert item.status == WorklistStatus.REFRESH


def test_resurface_ignores_not_yet_due(db):
    student = _student(db)
    _, sk = _dom_skill(db)
    item = _item(db, student, sk, status=WorklistStatus.PASSED)
    item.review_due_at = datetime.now(timezone.utc) + timedelta(days=3)  # future
    db.flush()
    assert fl.resurface_due(db, student.id) == 0
    assert item.status == WorklistStatus.PASSED


# --------------------------- refresh check outcomes --------------------------- #
def _answers(check, db, *, all_correct):
    qs = {str(q.id): q for q in db.query(Question).filter(Question.id.in_(check.question_ids)).all()}
    return {qid: ({"index": qs[qid].correct_answer_json["index"]} if all_correct else {"index": 99})
            for qid in check.question_ids}


def test_refresh_pass_promotes_and_reschedules(db):
    student = _student(db)
    dom, sk = _dom_skill(db); _pool(db, sk, dom)
    item = _item(db, student, sk, status=WorklistStatus.REFRESH)
    item.box = 1
    db.flush()
    check = mc.start_check(db, item, kind=MasteryCheckKind.REFRESH)
    res = mc.grade_check(db, check, _answers(check, db, all_correct=True))
    assert res["passed"] is True
    assert item.status == WorklistStatus.PASSED
    assert item.box == 2                      # promoted
    assert item.review_due_at is not None      # rescheduled


def test_refresh_fail_reopens_and_resets_box(db):
    student = _student(db)
    dom, sk = _dom_skill(db); _pool(db, sk, dom)
    item = _item(db, student, sk, status=WorklistStatus.REFRESH)
    item.box = 3
    db.flush()
    check = mc.start_check(db, item, kind=MasteryCheckKind.REFRESH)
    res = mc.grade_check(db, check, _answers(check, db, all_correct=False))
    assert res["passed"] is False
    assert item.status == WorklistStatus.IN_PROGRESS  # reopened
    assert item.box == 0                              # reset
    assert item.review_due_at is None


def test_mastery_pass_enters_review(db):
    student = _student(db)
    dom, sk = _dom_skill(db); _pool(db, sk, dom)
    item = _item(db, student, sk, status=WorklistStatus.OPEN)
    check = mc.start_check(db, item, kind=MasteryCheckKind.MASTERY)
    mc.grade_check(db, check, _answers(check, db, all_correct=True))
    assert item.status == WorklistStatus.PASSED
    assert item.box == 1                       # entered review at box 1
    assert item.review_due_at is not None
