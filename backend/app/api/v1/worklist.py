"""
Worklist API — the score-raising loop.

Student: view their live worklist, start a mastery/baseline check, submit it.
Tutor: view/edit a student's worklist and a cross-student overview.

Routes carry their own full paths; the router is included with no prefix.
See docs/superpowers/specs/2026-06-13-score-raising-loop-design.md.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.enums import UserRole, WorklistStatus, MasteryCheckKind
from app.models.taxonomy import Skill, Domain
from app.models.question import Question
from app.models.worklist import WorklistItem, MasteryCheck
from app.api.deps import get_current_user, get_current_tutor
from app.services import worklist_service as wl
from app.services import mastery_check_service as mc
from app.services import study_priority
from app.services.study_plan_service import _days_until_test

router = APIRouter()


# ----------------------------- schemas ----------------------------- #
class WorklistItemOut(BaseModel):
    id: str
    skill_id: int
    skill_name: str
    domain: Optional[str] = None
    status: str
    position: int
    baseline_accuracy: Optional[float] = None
    current_accuracy: Optional[float] = None
    has_lesson: bool
    lesson_id: Optional[str] = None
    source: str
    tutor_locked: bool
    mastery_attempts: int  # mastery-kind attempts so far (cap context for UI)
    tier: str = "quiet"    # "hero" = elevate (start here) | "quiet" = de-emphasized


class CheckQuestionOut(BaseModel):
    """A question served in a check — NO correct answer or explanation."""
    id: str
    subject_area: str
    answer_type: str
    prompt_html: str
    passage_html: Optional[str] = None
    choices: Optional[List[str]] = None


class StartCheckOut(BaseModel):
    check_id: str
    kind: str
    item_id: str
    questions: List[CheckQuestionOut]


class SubmitCheckIn(BaseModel):
    # question_id (str) -> answer dict, e.g. {"index": 2} or {"answer": "42"}
    answers: dict


class AddItemIn(BaseModel):
    skill_id: int


class PatchItemIn(BaseModel):
    status: Optional[str] = None          # done | open | in_progress | needs_tutor
    tutor_locked: Optional[bool] = None
    order: Optional[List[str]] = None     # full ordered id list (reorder)


# ----------------------------- helpers ----------------------------- #
def _skill_name(db: Session, skill_id: int) -> tuple[str, Optional[str]]:
    sk = db.query(Skill).filter(Skill.id == skill_id).first()
    if not sk:
        return (f"Skill {skill_id}", None)
    dom = db.query(Domain).filter(Domain.id == sk.domain_id).first() if sk.domain_id else None
    return (sk.name, dom.name if dom else None)


def _mastery_attempts(db: Session, item_id) -> int:
    return (
        db.query(MasteryCheck)
        .filter(
            MasteryCheck.worklist_item_id == item_id,
            MasteryCheck.kind == MasteryCheckKind.MASTERY,
        )
        .count()
    )


def _serialize(db: Session, item: WorklistItem) -> WorklistItemOut:
    name, domain = _skill_name(db, item.skill_id)
    return WorklistItemOut(
        id=str(item.id),
        skill_id=item.skill_id,
        skill_name=name,
        domain=domain,
        status=item.status.value,
        position=item.position,
        baseline_accuracy=item.baseline_accuracy,
        current_accuracy=item.current_accuracy,
        has_lesson=item.lesson_id is not None,
        lesson_id=str(item.lesson_id) if item.lesson_id else None,
        source=item.source,
        tutor_locked=item.tutor_locked,
        mastery_attempts=_mastery_attempts(db, item.id),
    )


def _serialize_question(q: Question) -> CheckQuestionOut:
    choices = None
    if q.choices_json:
        # choices_json is a list of HTML strings (per question bank usage).
        choices = list(q.choices_json)
    return CheckQuestionOut(
        id=str(q.id),
        subject_area=q.subject_area.value,
        answer_type=q.answer_type.value,
        prompt_html=q.prompt_html or "",
        passage_html=getattr(q, "passage_html", None),
        choices=choices,
    )


def _item_for_student(db: Session, item_id: UUID, student_id) -> WorklistItem:
    item = (
        db.query(WorklistItem)
        .filter(WorklistItem.id == item_id, WorklistItem.student_id == student_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Worklist item not found")
    return item


def _student_for_tutor(db: Session, student_id: UUID, tutor: User) -> User:
    s = (
        db.query(User)
        .filter(User.id == student_id, User.tutor_id == tutor.id,
                User.role == UserRole.STUDENT)
        .first()
    )
    if not s:
        raise HTTPException(status_code=404, detail="Student not in your roster")
    return s


# ----------------------------- student routes ----------------------------- #
@router.get("/worklist", response_model=List[WorklistItemOut], tags=["Worklist"])
def get_my_worklist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current student's live, ordered worklist (top items elevated)."""
    items = wl.list_for_student(db, current_user.id)
    out = [_serialize(db, i) for i in items]

    # Gently elevate the top N un-cleared items as "hero"; the rest stay visible
    # but quiet. N shrinks as the test nears (focus), never to zero.
    days = _days_until_test(current_user)
    hero_n = study_priority.how_many_hero_skills(days)
    promoted = 0
    active_statuses = {"open", "in_progress", "needs_tutor", "refresh"}
    for o in out:
        if promoted < hero_n and o.status in active_statuses:
            o.tier = "hero"
            promoted += 1
    return out


@router.post("/worklist/items/{item_id}/check", response_model=StartCheckOut, tags=["Worklist"])
def start_mastery_check(
    item_id: UUID,
    kind: str = "mastery",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a check (kind=mastery|baseline). Returns 5 questions, no answers."""
    item = _item_for_student(db, item_id, current_user.id)

    try:
        check_kind = MasteryCheckKind(kind)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid check kind")
    if check_kind == MasteryCheckKind.REFRESH:
        raise HTTPException(status_code=400, detail="Refresh checks are not available yet")

    # Enforce the mastery retry cap up front.
    if check_kind == MasteryCheckKind.MASTERY and item.status == WorklistStatus.NEEDS_TUTOR:
        raise HTTPException(
            status_code=409,
            detail="This skill needs tutor attention before another attempt.",
        )

    try:
        check = mc.start_check(db, item, kind=check_kind)
    except mc.MasteryCheckError as e:
        raise HTTPException(status_code=422, detail=str(e))

    q_by_id = {
        str(q.id): q
        for q in db.query(Question).filter(Question.id.in_(check.question_ids)).all()
    }
    questions = [_serialize_question(q_by_id[qid]) for qid in check.question_ids if qid in q_by_id]
    db.commit()
    return StartCheckOut(
        check_id=str(check.id), kind=check.kind.value, item_id=str(item.id),
        questions=questions,
    )


@router.post("/worklist/checks/{check_id}/submit", tags=["Worklist"])
def submit_mastery_check(
    check_id: UUID,
    body: SubmitCheckIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grade a check, transition the item, and return the result + next item."""
    check = (
        db.query(MasteryCheck)
        .filter(MasteryCheck.id == check_id, MasteryCheck.student_id == current_user.id)
        .first()
    )
    if not check:
        raise HTTPException(status_code=404, detail="Check not found")
    if check.score is not None:
        raise HTTPException(status_code=409, detail="This check was already submitted")

    result = mc.grade_check(db, check, body.answers or {})
    db.commit()
    return result


# ----------------------------- tutor routes ----------------------------- #
@router.get("/tutor/students/{student_id}/worklist", response_model=List[WorklistItemOut], tags=["Worklist"])
def get_student_worklist(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """A tutor views one of their students' worklist."""
    _student_for_tutor(db, student_id, current_user)
    items = wl.list_for_student(db, student_id)
    return [_serialize(db, i) for i in items]


@router.post("/tutor/students/{student_id}/worklist/items", response_model=WorklistItemOut, tags=["Worklist"])
def add_student_item(
    student_id: UUID,
    body: AddItemIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """Tutor adds a skill to a student's worklist (locked)."""
    _student_for_tutor(db, student_id, current_user)
    if not db.query(Skill).filter(Skill.id == body.skill_id).first():
        raise HTTPException(status_code=404, detail="Skill not found")
    item = wl.add_tutor_item(db, student_id, body.skill_id)
    db.commit()
    return _serialize(db, item)


@router.patch("/tutor/worklist/items/{item_id}", response_model=WorklistItemOut, tags=["Worklist"])
def patch_item(
    item_id: UUID,
    body: PatchItemIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """Tutor edits an item: reorder, mark done/reopen, lock."""
    item = db.query(WorklistItem).filter(WorklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Worklist item not found")
    _student_for_tutor(db, item.student_id, current_user)

    if body.order is not None:
        wl.reorder(db, item.student_id, body.order)
    if body.status is not None:
        try:
            wl.set_status(db, item, WorklistStatus(body.status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    if body.tutor_locked is not None:
        item.tutor_locked = body.tutor_locked
        db.flush()

    db.commit()
    db.refresh(item)
    return _serialize(db, item)


@router.delete("/tutor/worklist/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Worklist"])
def delete_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """Tutor removes an item."""
    item = db.query(WorklistItem).filter(WorklistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Worklist item not found")
    _student_for_tutor(db, item.student_id, current_user)
    wl.remove(db, item)
    db.commit()


@router.get("/tutor/worklist/overview", tags=["Worklist"])
def worklist_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """
    Cross-student snapshot: per student, counts of cleared / stuck / not-started.
    Drives 'where do I spend my hours' for the tutor.
    """
    students = (
        db.query(User)
        .filter(User.tutor_id == current_user.id, User.role == UserRole.STUDENT,
                User.is_active == True)  # noqa: E712
        .all()
    )
    sids = [s.id for s in students]
    items_by_student: dict = {sid: [] for sid in sids}
    if sids:
        for wi in db.query(WorklistItem).filter(WorklistItem.student_id.in_(sids)).all():
            items_by_student.setdefault(wi.student_id, []).append(wi)

    out = []
    for s in students:
        items = items_by_student.get(s.id, [])
        cleared = sum(1 for i in items if i.status in (WorklistStatus.DONE, WorklistStatus.PASSED))
        stuck = sum(1 for i in items if i.status == WorklistStatus.NEEDS_TUTOR)
        not_started = sum(1 for i in items if i.status == WorklistStatus.OPEN)
        in_progress = sum(1 for i in items if i.status == WorklistStatus.IN_PROGRESS)
        out.append({
            "student_id": str(s.id),
            "first_name": s.first_name,
            "last_name": s.last_name,
            "total": len(items),
            "cleared": cleared,
            "stuck": stuck,
            "in_progress": in_progress,
            "not_started": not_started,
        })
    # Stuck students first — they need attention.
    out.sort(key=lambda r: (-r["stuck"], -r["in_progress"]))
    return out
