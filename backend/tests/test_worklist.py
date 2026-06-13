"""
Tests for the score-raising loop: worklist generation, mastery-check question
selection + grading + pass rule, retry cap, and tutor edits.

Calls services/endpoint functions directly (the repo's HTTP TestClient is
unusable under its Starlette/httpx pin — same approach as join/delete tests).
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.user import User
from app.models.enums import (
    UserRole, SubjectArea, AnswerType, DifficultyLevel, WorklistStatus,
    MasteryCheckKind, TestType, TestStatus,
)
from app.models.taxonomy import Domain, Skill
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.test import TestSession
from app.models.worklist import WorklistItem, MasteryCheck
from app.core.security import get_password_hash

from app.services import worklist_service as wl
from app.services import mastery_check_service as mc
from app.api.v1 import worklist as wl_api


# --------------------------------------------------------------------------- #
# Fixtures: a domain + skill + a tagged question pool across bands.
# --------------------------------------------------------------------------- #
def _domain(db):
    d = Domain(name="Algebra", subject_area=SubjectArea.MATH, code=f"D{uuid.uuid4().hex[:4]}")
    db.add(d); db.flush(); return d


def _skill(db, domain):
    s = Skill(name="Systems of equations", domain_id=domain.id,
              code=f"S{uuid.uuid4().hex[:4]}")
    db.add(s); db.flush(); return s


def _q(db, skill, domain, band, *, correct_index=1):
    q = Question(
        external_id=f"ext-{uuid.uuid4().hex[:8]}",
        subject_area=SubjectArea.MATH,
        domain_id=domain.id,
        skill_id=skill.id,
        answer_type=AnswerType.MCQ,
        difficulty=band,
        prompt_html="<p>solve</p>",
        choices_json=["A", "B", "C", "D"],
        correct_answer_json={"index": correct_index},
        is_active=True,
    )
    db.add(q); db.flush(); return q


def _pool(db, skill, domain, *, per_band=4):
    """Create per_band questions in each of E/M/H (correct index = 1)."""
    qs = {"E": [], "M": [], "H": []}
    for band in (DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD):
        for _ in range(per_band):
            qs[band.value].append(_q(db, skill, domain, band))
    return qs


def _student(db, tutor_id=None):
    u = User(id=uuid.uuid4(), email=f"s-{uuid.uuid4().hex[:6]}@t.com",
             password_hash=get_password_hash("TestPass123"),
             first_name="Stu", last_name="Dent", role=UserRole.STUDENT,
             is_active=True, is_verified=True, profile_data={}, tutor_id=tutor_id)
    db.add(u); db.flush(); return u


def _item(db, student, skill):
    it = WorklistItem(student_id=student.id, skill_id=skill.id,
                      status=WorklistStatus.OPEN, position=0, source="auto")
    db.add(it); db.flush(); return it


def _answers_for(check, db, *, correct_bands):
    """Build an answers dict: correct for questions whose band is in correct_bands."""
    qs = {str(q.id): q for q in db.query(Question).filter(Question.id.in_(check.question_ids)).all()}
    answers = {}
    for qid in check.question_ids:
        q = qs[qid]
        band = q.difficulty.value
        if band in correct_bands:
            answers[qid] = {"index": q.correct_answer_json["index"]}
        else:
            answers[qid] = {"index": 99}  # wrong
    return answers


# --------------------------------------------------------------------------- #
# Question selection
# --------------------------------------------------------------------------- #
def test_check_has_fixed_band_spread(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    student = _student(db)
    qs = mc.select_check_questions(db, sk.id, student.id)
    bands = sorted(q.difficulty.value for q in qs)
    assert bands == ["E", "H", "H", "M", "M"]  # 1E, 2M, 2H
    assert len({q.id for q in qs}) == 5  # no duplicates


def test_check_excludes_untagged(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    # add an untagged question — must never be selected
    untag = Question(external_id=f"ext-{uuid.uuid4().hex[:8]}", subject_area=SubjectArea.MATH,
                     domain_id=dom.id, skill_id=sk.id, answer_type=AnswerType.MCQ,
                     difficulty=None, prompt_html="x", choices_json=["A"],
                     correct_answer_json={"index": 0}, is_active=True)
    db.add(untag); db.flush()
    student = _student(db)
    for _ in range(5):
        qs = mc.select_check_questions(db, sk.id, student.id)
        assert untag.id not in {q.id for q in qs}


def test_check_raises_when_band_unfillable(db):
    dom = _domain(db); sk = _skill(db, dom)
    # only easy questions exist -> can't fill medium/hard
    for _ in range(3):
        _q(db, sk, dom, DifficultyLevel.EASY)
    student = _student(db)
    with pytest.raises(mc.MasteryCheckError):
        mc.select_check_questions(db, sk.id, student.id)


# --------------------------------------------------------------------------- #
# Pass rule edge cases (the heart of the design)
# --------------------------------------------------------------------------- #
def test_pass_requires_hard__4of5_with_zero_hard_fails(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    student = _student(db)
    item = _item(db, student, sk)
    check = mc.start_check(db, item, kind=MasteryCheckKind.MASTERY)
    # correct on E + both M + ... but miss both H -> 3 correct, but make it 4 by
    # constructing: correct E, M, M, and one more — yet hards both wrong.
    # With 1E+2M = 3 correct max without hard. To hit 4/5 we MUST get a hard.
    # So to test "4/5 with 0 hard" we can't actually reach 4 without a hard.
    # Instead test the real risk: 3/5 (all non-hard) -> fail.
    answers = _answers_for(check, db, correct_bands={"E", "M"})  # 3 correct, 0 hard
    res = mc.grade_check(db, check, answers)
    assert res["score"] == 3
    assert res["hard_correct"] == 0
    assert res["passed"] is False
    assert item.status == WorklistStatus.IN_PROGRESS


def test_pass__4of5_with_one_hard_passes(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    student = _student(db)
    item = _item(db, student, sk)
    check = mc.start_check(db, item, kind=MasteryCheckKind.MASTERY)
    # correct: E + 2M + 1H = 4/5 with 1 hard -> PASS
    qs = {str(q.id): q for q in db.query(Question).filter(Question.id.in_(check.question_ids)).all()}
    answers = {}
    hard_done = False
    for qid in check.question_ids:
        q = qs[qid]; band = q.difficulty.value
        give_correct = band in ("E", "M") or (band == "H" and not hard_done)
        if band == "H" and not hard_done and give_correct:
            hard_done = True
        answers[qid] = {"index": q.correct_answer_json["index"] if give_correct else 99}
    res = mc.grade_check(db, check, answers)
    assert res["score"] == 4 and res["hard_correct"] == 1
    assert res["passed"] is True
    assert item.status == WorklistStatus.PASSED
    assert item.completed_at is not None
    assert item.current_accuracy == 80.0


def test_perfect_passes(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    student = _student(db); item = _item(db, student, sk)
    check = mc.start_check(db, item, kind=MasteryCheckKind.MASTERY)
    answers = _answers_for(check, db, correct_bands={"E", "M", "H"})
    res = mc.grade_check(db, check, answers)
    assert res["score"] == 5 and res["passed"] is True


# --------------------------------------------------------------------------- #
# Retry cap -> needs_tutor
# --------------------------------------------------------------------------- #
def test_two_fails_sets_needs_tutor(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom, per_band=8)
    student = _student(db); item = _item(db, student, sk)

    c1 = mc.start_check(db, item, kind=MasteryCheckKind.MASTERY)
    assert c1.attempt_number == 1
    mc.grade_check(db, c1, _answers_for(c1, db, correct_bands=set()))  # 0/5 fail
    assert item.status == WorklistStatus.IN_PROGRESS

    c2 = mc.start_check(db, item, kind=MasteryCheckKind.MASTERY)
    assert c2.attempt_number == 2
    mc.grade_check(db, c2, _answers_for(c2, db, correct_bands=set()))  # fail again
    assert item.status == WorklistStatus.NEEDS_TUTOR


# --------------------------------------------------------------------------- #
# Baseline check measures without gating
# --------------------------------------------------------------------------- #
def test_baseline_records_before_without_passfail(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    student = _student(db); item = _item(db, student, sk)
    check = mc.start_check(db, item, kind=MasteryCheckKind.BASELINE)
    res = mc.grade_check(db, check, _answers_for(check, db, correct_bands={"E"}))
    assert res["passed"] is None
    assert item.baseline_check_id == check.id
    assert item.baseline_accuracy == 20.0  # 1/5
    # baseline does not complete the item
    assert item.status != WorklistStatus.PASSED


# --------------------------------------------------------------------------- #
# Generation from an imported session
# --------------------------------------------------------------------------- #
def test_generate_from_session_creates_weak_items(db):
    dom = _domain(db); sk = _skill(db, dom)
    qs = _pool(db, sk, dom)
    student = _student(db)
    session = TestSession(student_id=student.id, test_type=TestType.OFFICIAL_PRACTICE,
                          status=TestStatus.COMPLETED, questions_answered=2,
                          questions_correct=0, current_question_index=0,
                          session_state={"test_number": 6})
    db.add(session); db.flush()
    # 2 responses on this skill, both wrong -> 0% accuracy (weak)
    for q in qs["M"][:2]:
        db.add(StudentResponse(student_id=student.id, question_id=q.id,
                               test_session_id=session.id, is_correct=False,
                               response_json={"index": 0},
                               submitted_at=datetime.now(timezone.utc)))
    db.flush()

    created = wl.generate_from_session(db, session)
    assert len(created) == 1
    assert created[0].skill_id == sk.id
    assert created[0].baseline_accuracy == 0.0
    assert created[0].status == WorklistStatus.OPEN


def test_regen_preserves_locked_and_done(db):
    dom = _domain(db); sk = _skill(db, dom); qs = _pool(db, sk, dom)
    student = _student(db)
    # pre-existing tutor-locked DONE item for this skill
    locked = WorklistItem(student_id=student.id, skill_id=sk.id,
                          status=WorklistStatus.DONE, position=0,
                          source="tutor", tutor_locked=True)
    db.add(locked); db.flush()

    session = TestSession(student_id=student.id, test_type=TestType.OFFICIAL_PRACTICE,
                          status=TestStatus.COMPLETED, questions_answered=2,
                          questions_correct=0, current_question_index=0,
                          session_state={"test_number": 7})
    db.add(session); db.flush()
    for q in qs["M"][:2]:
        db.add(StudentResponse(student_id=student.id, question_id=q.id,
                               test_session_id=session.id, is_correct=False,
                               response_json={"index": 0},
                               submitted_at=datetime.now(timezone.utc)))
    db.flush()

    created = wl.generate_from_session(db, session)
    # skill already tracked -> no new item, and the locked DONE item is untouched
    assert created == []
    db.refresh(locked)
    assert locked.status == WorklistStatus.DONE
    assert locked.tutor_locked is True


# --------------------------------------------------------------------------- #
# Tutor edits + auth
# --------------------------------------------------------------------------- #
def test_tutor_add_reorder_override(db, test_tutor):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    sk2 = _skill(db, dom)
    student = _student(db, tutor_id=test_tutor.id)

    item = wl.add_tutor_item(db, student.id, sk.id)
    assert item.source == "tutor" and item.tutor_locked is True

    item2 = wl.add_tutor_item(db, student.id, sk2.id)
    wl.reorder(db, student.id, [str(item2.id), str(item.id)])
    db.refresh(item); db.refresh(item2)
    assert item2.position < item.position

    wl.set_status(db, item, WorklistStatus.DONE)
    assert item.status == WorklistStatus.DONE and item.completed_at is not None


def test_tutor_cannot_touch_other_students_item(db, test_tutor):
    dom = _domain(db); sk = _skill(db, dom)
    stranger = _student(db, tutor_id=None)  # not this tutor's student
    item = _item(db, stranger, sk)
    from app.api.v1.worklist import patch_item, PatchItemIn
    with pytest.raises(HTTPException) as ei:
        patch_item(item.id, PatchItemIn(status="done"), db=db, current_user=test_tutor)
    assert ei.value.status_code == 404


def test_student_worklist_endpoint_serializes(db):
    dom = _domain(db); sk = _skill(db, dom); _pool(db, sk, dom)
    student = _student(db)
    _item(db, student, sk)
    out = wl_api.get_my_worklist(db=db, current_user=student)
    assert len(out) == 1
    assert out[0].skill_name == "Systems of equations"
    assert out[0].status == "open"
