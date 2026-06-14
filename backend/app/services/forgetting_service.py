"""
Forgetting loop — Leitner-style spaced repetition for mastered skills.

When a student clears a skill (passes its mastery check), we schedule a future
"refresh" review. Each successful review promotes the skill to a higher Leitner
box (longer interval); a failed review demotes it back to box 1 and reopens it.
Intervals expand to flatten the Ebbinghaus forgetting curve, but every interval
is CLAMPED to the student's test date — we never schedule a review the student
won't take, and we compress reviews so each skill gets a final refresh shortly
before the exam.

Review unit is the SKILL, not a single question: each refresh draws fresh
questions of matching difficulty (handled by mastery_check_service).

See docs/superpowers/specs/2026-06-13-study-plan-and-forgetting-notes.md.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.worklist import WorklistItem
from app.models.enums import WorklistStatus
from app.services.study_plan_service import _days_until_test

# Leitner intervals in days, indexed by box (box 1 → 2 days, box 2 → 4, …).
# Doubling-ish; box caps at the last entry.
BOX_INTERVALS = [2, 4, 7, 14, 30]
MAX_BOX = len(BOX_INTERVALS)

# In the final stretch before a test, guarantee a refresh this many days out
# (so every mastered skill gets one last touch near peak retention).
FINAL_REFRESH_DAYS = 2


def _interval_days(box: int) -> int:
    idx = max(1, min(box, MAX_BOX)) - 1
    return BOX_INTERVALS[idx]


def schedule_review(db: Session, item: WorklistItem, *, promote: bool, student: Optional[User] = None):
    """
    Schedule the next refresh for a just-passed skill.

    promote=True  → advance one Leitner box (longer interval) — a passed review.
    promote=False → (re)enter review at box 1 — first time the skill is mastered.

    The due date is clamped to the test date: never after the test, and in the
    final window we pull it to FINAL_REFRESH_DAYS before the exam.
    """
    if student is None:
        student = db.query(User).filter(User.id == item.student_id).first()

    item.box = min(item.box + 1, MAX_BOX) if promote else 1
    interval = _interval_days(item.box)

    now = datetime.now(timezone.utc)
    due = now + timedelta(days=interval)

    days_left = _days_until_test(student)
    if days_left is not None:
        test_day = now + timedelta(days=days_left)
        # Never schedule a review the student won't reach.
        if days_left <= 0:
            item.review_due_at = None      # test passed; nothing to schedule
            return item
        # Clamp: if the natural interval lands on/after the test, pull it to a
        # final pre-test refresh (but not into the past).
        latest = test_day - timedelta(days=FINAL_REFRESH_DAYS)
        if due > latest:
            due = max(now + timedelta(days=1), latest)
            if due >= test_day:
                due = now + timedelta(days=1)
    item.review_due_at = due
    return item


def resurface_due(db: Session, student_id) -> int:
    """
    Flip any mastered skill whose review_due_at has passed into a `refresh` item
    so it shows back up on the worklist. Lazy: call on worklist load. Returns the
    count resurfaced.
    """
    now = datetime.now(timezone.utc)
    # Both PASSED (auto-cleared by a check) and DONE (tutor-confirmed) are
    # "cleared" states eligible to resurface for review.
    due_items = (
        db.query(WorklistItem)
        .filter(
            WorklistItem.student_id == student_id,
            WorklistItem.status.in_([WorklistStatus.DONE, WorklistStatus.PASSED]),
            WorklistItem.review_due_at.isnot(None),
            WorklistItem.review_due_at <= now,
        )
        .all()
    )
    for item in due_items:
        item.status = WorklistStatus.REFRESH
    if due_items:
        db.flush()
    return len(due_items)
