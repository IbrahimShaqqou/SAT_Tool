"""
Worklist service.

The live, ordered "what to work on between practice tests" list. Auto-generates
from a practice test's weak skills (reusing study_plan_service._skill_rollup),
and supports tutor refinement (reorder, add, remove, lock, override). The
auto-generator never disturbs tutor-locked or completed items.

See docs/superpowers/specs/2026-06-13-score-raising-loop-design.md.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.lesson import Lesson
from app.models.taxonomy import Skill, Domain
from app.models.user import User
from app.models.worklist import WorklistItem
from app.models.enums import WorklistStatus
from app.services.study_plan_service import _skill_rollup, WEAK_THRESHOLD, _days_until_test
from app.services import study_priority


def _domain_code_by_skill(db: Session, skill_ids: list) -> dict:
    """Map skill_id -> its domain's CB code (for frequency/learnability weights)."""
    if not skill_ids:
        return {}
    rows = (
        db.query(Skill.id, Domain.code)
        .join(Domain, Domain.id == Skill.domain_id)
        .filter(Skill.id.in_(skill_ids))
        .all()
    )
    return {sid: code for sid, code in rows}

# Cap how many auto-generated items we add per import, so the list stays focused.
AUTO_ITEM_CAP = 6

# Statuses the auto-generator must never disturb.
_PROTECTED = {WorklistStatus.DONE, WorklistStatus.PASSED}


def _lesson_id_for_skill(db: Session, skill_id: int) -> Optional[str]:
    lesson = db.query(Lesson).filter(Lesson.skill_id == skill_id).first()
    return str(lesson.id) if lesson else None


def generate_from_session(db: Session, session) -> list[WorklistItem]:
    """
    Add worklist items for the weak skills in this imported test session.

    Idempotent and additive: only creates items for weak skills the student does
    not already have an ACTIVE item for. Never touches tutor-locked or completed
    items. Returns the items created (may be empty).
    """
    rollup = _skill_rollup(db, session.id)
    if not rollup:
        return []

    weak = [
        s for s in rollup
        if s.get("skill_id") is not None and s["accuracy"] < WEAK_THRESHOLD
    ]

    # Rank by impact: weakness × domain frequency × learnability × test proximity
    # (not raw accuracy). Closer test date sharpens toward the highest-impact few.
    student = db.query(User).filter(User.id == session.student_id).first()
    days = _days_until_test(student)
    code_by_skill = _domain_code_by_skill(db, [s["skill_id"] for s in weak])
    for s in weak:
        s["_priority"] = study_priority.priority_score(
            s["accuracy"], code_by_skill.get(s["skill_id"]), days
        )
    weak.sort(key=lambda s: (-s["_priority"], s["accuracy"]))  # highest impact first
    weak = weak[:AUTO_ITEM_CAP]

    existing = {
        wi.skill_id: wi
        for wi in db.query(WorklistItem).filter(
            WorklistItem.student_id == session.student_id
        ).all()
    }

    # Position new items after whatever the student already has.
    max_pos = max((wi.position for wi in existing.values()), default=-1)

    created = []
    for s in weak:
        skill_id = s["skill_id"]
        if skill_id in existing:
            # Already tracked — leave it alone (tutor edits / progress preserved).
            continue
        max_pos += 1
        item = WorklistItem(
            student_id=session.student_id,
            skill_id=skill_id,
            source_session_id=session.id,
            status=WorklistStatus.OPEN,
            position=max_pos,
            baseline_accuracy=s["accuracy"],
            source="auto",
            tutor_locked=False,
            lesson_id=s.get("lesson_id") or _lesson_id_for_skill(db, skill_id),
        )
        db.add(item)
        created.append(item)

    db.flush()
    return created


def list_for_student(db: Session, student_id) -> list[WorklistItem]:
    """The student's worklist, ordered by position then creation."""
    return (
        db.query(WorklistItem)
        .filter(WorklistItem.student_id == student_id)
        .order_by(WorklistItem.position.asc(), WorklistItem.created_at.asc())
        .all()
    )


def add_tutor_item(db: Session, student_id, skill_id: int) -> WorklistItem:
    """Tutor adds a skill. Locked so the auto-generator won't remove it."""
    existing = (
        db.query(WorklistItem)
        .filter(
            WorklistItem.student_id == student_id,
            WorklistItem.skill_id == skill_id,
        )
        .first()
    )
    if existing:
        existing.tutor_locked = True
        db.flush()
        return existing

    max_pos = (
        db.query(WorklistItem.position)
        .filter(WorklistItem.student_id == student_id)
        .order_by(WorklistItem.position.desc())
        .first()
    )
    next_pos = (max_pos[0] + 1) if max_pos else 0
    item = WorklistItem(
        student_id=student_id,
        skill_id=skill_id,
        status=WorklistStatus.OPEN,
        position=next_pos,
        source="tutor",
        tutor_locked=True,
        lesson_id=_lesson_id_for_skill(db, skill_id),
    )
    db.add(item)
    db.flush()
    return item


def reorder(db: Session, student_id, ordered_item_ids: list) -> None:
    """Set position to match the given id order (ids not listed keep trailing)."""
    items = {str(wi.id): wi for wi in list_for_student(db, student_id)}
    pos = 0
    for iid in ordered_item_ids:
        wi = items.get(str(iid))
        if wi:
            wi.position = pos
            pos += 1
    db.flush()


def set_status(db: Session, item: WorklistItem, status: WorklistStatus) -> WorklistItem:
    """Tutor override of an item's status (done/reopen/etc.)."""
    item.status = status
    if status == WorklistStatus.DONE:
        item.completed_at = datetime.now(timezone.utc)
    elif status in (WorklistStatus.OPEN, WorklistStatus.IN_PROGRESS):
        item.completed_at = None
    db.flush()
    return item


def remove(db: Session, item: WorklistItem) -> None:
    db.delete(item)
    db.flush()
