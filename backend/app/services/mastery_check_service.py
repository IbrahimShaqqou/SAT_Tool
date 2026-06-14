"""
Mastery check service.

A mastery check is a fixed-difficulty-spread quiz (1 easy / 2 medium / 2 hard)
that proves whether a student has actually mastered a skill — not just the easy
questions. Used for the worklist gate, the optional baseline measurement, and
(future) the forgetting-loop refresh.

Pass rule (mastery kind): >=4/5 overall AND >=1 of 2 hard correct. You can't pass
on easy/medium alone. Baseline checks have no pass gate (they just measure).

See docs/superpowers/specs/2026-06-13-score-raising-loop-design.md.
"""

import random
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.response import StudentResponse
from app.models.enums import DifficultyLevel, MasteryCheckKind, WorklistStatus
from app.models.worklist import WorklistItem, MasteryCheck
from app.services.answer_checker import check_answer

# Fixed spread: 1 easy, 2 medium, 2 hard = 5 questions.
CHECK_SPREAD = [
    (DifficultyLevel.EASY, 1),
    (DifficultyLevel.MEDIUM, 2),
    (DifficultyLevel.HARD, 2),
]
PASS_SCORE = 4          # of 5
PASS_MIN_HARD = 1       # of 2 hard
MAX_MASTERY_ATTEMPTS = 2  # then -> needs_tutor


class MasteryCheckError(Exception):
    """Raised when a check cannot be built (e.g. not enough tagged questions)."""


def _recent_question_ids(db: Session, student_id, skill_id, limit: int = 40) -> set:
    """Question ids this student answered recently for this skill, to avoid reuse."""
    rows = (
        db.query(StudentResponse.question_id)
        .join(Question, Question.id == StudentResponse.question_id)
        .filter(
            StudentResponse.student_id == student_id,
            Question.skill_id == skill_id,
        )
        .order_by(StudentResponse.submitted_at.desc().nullslast())
        .limit(limit)
        .all()
    )
    return {r[0] for r in rows}


def select_check_questions(db: Session, skill_id: int, student_id, *, rng=random) -> list:
    """
    Pick 1 easy / 2 medium / 2 hard tagged questions for a skill, preferring ones
    the student hasn't seen recently. Returns Question objects in served order.
    Raises MasteryCheckError if a band can't be filled even after reuse.
    """
    avoid = _recent_question_ids(db, student_id, skill_id)
    picked: list = []

    for band, n in CHECK_SPREAD:
        pool = (
            db.query(Question)
            .filter(
                Question.skill_id == skill_id,
                Question.difficulty == band,        # tagged-only: None never matches
                Question.is_active == True,         # noqa: E712
            )
            .all()
        )
        fresh = [q for q in pool if q.id not in avoid]
        chosen_pool = fresh if len(fresh) >= n else pool  # fall back to reuse if needed
        if len(chosen_pool) < n:
            raise MasteryCheckError(
                f"Not enough {band.value} questions for skill {skill_id} "
                f"({len(chosen_pool)} available, need {n})."
            )
        chosen = rng.sample(chosen_pool, n)
        picked.extend(chosen)
        avoid.update(q.id for q in chosen)

    return picked


def start_check(
    db: Session,
    item: WorklistItem,
    *,
    kind: MasteryCheckKind = MasteryCheckKind.MASTERY,
    rng=random,
) -> MasteryCheck:
    """
    Create a MasteryCheck row with selected questions (unanswered yet). For
    mastery checks, attempt_number increments from prior mastery attempts.
    """
    questions = select_check_questions(db, item.skill_id, item.student_id, rng=rng)

    attempt_number = 1
    if kind == MasteryCheckKind.MASTERY:
        prior = (
            db.query(MasteryCheck)
            .filter(
                MasteryCheck.worklist_item_id == item.id,
                MasteryCheck.kind == MasteryCheckKind.MASTERY,
            )
            .count()
        )
        attempt_number = prior + 1

    check = MasteryCheck(
        worklist_item_id=item.id,
        student_id=item.student_id,
        kind=kind,
        question_ids=[str(q.id) for q in questions],
        attempt_number=attempt_number,
    )
    db.add(check)
    db.flush()

    # Move the item into progress when a real attempt starts.
    if item.status == WorklistStatus.OPEN:
        item.status = WorklistStatus.IN_PROGRESS
    return check


def grade_check(db: Session, check: MasteryCheck, answers: dict) -> dict:
    """
    Grade a check. `answers` maps question_id (str) -> submitted answer dict
    (e.g. {"index": 2} or {"answer": "42"}).

    Records per-question results, score, hard_correct, passed (mastery/refresh),
    and drives the worklist item's status transition. Returns a result summary.
    """
    q_ids = [str(qid) for qid in (check.question_ids or [])]
    questions = {
        str(q.id): q
        for q in db.query(Question).filter(Question.id.in_(q_ids)).all()
    }

    responses = []
    score = 0
    hard_correct = 0
    band_missed = {"E": 0, "M": 0, "H": 0}
    for qid in q_ids:
        q = questions.get(qid)
        if q is None:
            continue
        submitted = answers.get(qid, {}) or {}
        is_correct = check_answer(
            q.correct_answer_json, submitted, q.answer_type.value
        )
        band = q.difficulty.value if q.difficulty else "?"
        if is_correct:
            score += 1
            if band == "H":
                hard_correct += 1
        else:
            if band in band_missed:
                band_missed[band] += 1
        responses.append({
            "question_id": qid,
            "band": band,
            "submitted": submitted,
            "correct": is_correct,
        })

    check.responses = responses
    check.score = score
    check.hard_correct = hard_correct

    item = check.worklist_item
    total = len(q_ids)
    accuracy = round(100 * score / total, 1) if total else 0.0

    if check.kind == MasteryCheckKind.BASELINE:
        # Baseline only measures; no pass/fail, no status change beyond the
        # baseline pointer + recording the "before".
        check.passed = None
        item.baseline_check_id = check.id
        if item.baseline_accuracy is None:
            item.baseline_accuracy = accuracy
        db.flush()
        return _result(check, accuracy, item, band_missed, next_item=None)

    # Mastery / refresh gate (same pass rule).
    from app.services import forgetting_service as fl
    passed = score >= PASS_SCORE and hard_correct >= PASS_MIN_HARD
    check.passed = passed
    item.current_accuracy = accuracy
    is_refresh = check.kind == MasteryCheckKind.REFRESH
    next_item = None

    if passed:
        item.status = WorklistStatus.PASSED
        item.completed_at = datetime.now(timezone.utc)
        # Forgetting loop: a passed refresh PROMOTES the Leitner box (longer
        # interval); a first mastery pass enters review at box 1.
        fl.schedule_review(db, item, promote=is_refresh)
        if not is_refresh:
            next_item = _next_open_item(db, item)
    else:
        if is_refresh:
            # A failed refresh means the skill faded — reopen it and reset the
            # Leitner box so it's re-learned from scratch.
            item.status = WorklistStatus.IN_PROGRESS
            item.box = 0
            item.review_due_at = None
        elif check.attempt_number >= MAX_MASTERY_ATTEMPTS:
            item.status = WorklistStatus.NEEDS_TUTOR
        else:
            item.status = WorklistStatus.IN_PROGRESS

    db.flush()
    return _result(check, accuracy, item, band_missed, next_item=next_item)


def _next_open_item(db: Session, item: WorklistItem) -> Optional[WorklistItem]:
    """The student's next not-yet-started item, by position."""
    return (
        db.query(WorklistItem)
        .filter(
            WorklistItem.student_id == item.student_id,
            WorklistItem.status == WorklistStatus.OPEN,
            WorklistItem.id != item.id,
        )
        .order_by(WorklistItem.position.asc(), WorklistItem.created_at.asc())
        .first()
    )


def _result(check, accuracy, item, band_missed, next_item):
    return {
        "check_id": str(check.id),
        "kind": check.kind.value,
        "score": check.score,
        "total": len(check.question_ids or []),
        "hard_correct": check.hard_correct,
        "accuracy": accuracy,
        "passed": check.passed,
        "attempt_number": check.attempt_number,
        "item_status": item.status.value,
        "bands_missed": {k: v for k, v in band_missed.items() if v},
        "next_item_id": str(next_item.id) if next_item else None,
    }
