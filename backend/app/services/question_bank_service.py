"""
Question Bank service.

Backs the redesigned, study-oriented Question Bank: filterable/searchable
browsing with per-student status (attempted / correct / incorrect / bookmarked),
persistent attempts, bookmarks, and per-skill stats.

Attempts are stored as StudentResponse rows with test_session_id = NULL and a
`_source: "question_bank"` marker in response_json — so bank practice persists,
powers wrong-answer review, and (like adaptive) contributes to skill data,
without a new table or a column migration on the hot responses table.

See docs/superpowers/specs/2026-06-13-question-bank-redesign-design.md.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.question import Question
from app.models.response import StudentResponse
from app.models.question_bookmark import QuestionBookmark

BANK_SOURCE = "question_bank"


def _attempt_maps(db: Session, student_id, question_ids: list) -> tuple[dict, set]:
    """
    For the given questions, return:
      - latest correctness per question_id (True/False), most recent attempt wins
      - set of bookmarked question_ids
    Restricted to this student's bank-or-any responses.
    """
    if not question_ids:
        return {}, set()

    rows = (
        db.query(StudentResponse.question_id, StudentResponse.is_correct,
                 StudentResponse.submitted_at)
        .filter(
            StudentResponse.student_id == student_id,
            StudentResponse.question_id.in_(question_ids),
        )
        .order_by(StudentResponse.submitted_at.asc().nullsfirst())
        .all()
    )
    # Later rows overwrite earlier -> ends on the most recent attempt.
    correctness = {}
    for qid, is_correct, _ in rows:
        correctness[qid] = bool(is_correct)

    bm = {
        b.question_id
        for b in db.query(QuestionBookmark.question_id).filter(
            QuestionBookmark.student_id == student_id,
            QuestionBookmark.question_id.in_(question_ids),
        )
    }
    return correctness, bm


def list_questions(
    db: Session,
    *,
    student_id=None,
    subject=None,
    domain_id: Optional[int] = None,
    skill_id: Optional[int] = None,
    difficulty=None,
    answer_type=None,
    status: Optional[str] = None,   # unattempted | correct | incorrect
    bookmarked: bool = False,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    Filtered question query. status/bookmarked filters require student_id.
    Returns {items: [Question], total, per-question status maps}.
    """
    query = db.query(Question).filter(
        Question.is_active == True,        # noqa: E712
        Question.deleted_at == None,       # noqa: E711
    )

    if subject:
        query = query.filter(Question.subject_area == subject)
    if domain_id:
        query = query.filter(Question.domain_id == domain_id)
    if skill_id:
        query = query.filter(Question.skill_id == skill_id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    if answer_type:
        query = query.filter(Question.answer_type == answer_type)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(
            Question.prompt_html.ilike(like),
            Question.external_id.ilike(like),
        ))

    # Per-student status filters via subqueries on StudentResponse / bookmarks.
    if student_id and (status or bookmarked):
        if bookmarked:
            bm_subq = db.query(QuestionBookmark.question_id).filter(
                QuestionBookmark.student_id == student_id
            ).subquery()
            query = query.filter(Question.id.in_(bm_subq.select()))

        if status in ("unattempted", "attempted"):
            attempted_subq = db.query(StudentResponse.question_id).filter(
                StudentResponse.student_id == student_id
            ).subquery()
            if status == "unattempted":
                query = query.filter(~Question.id.in_(attempted_subq.select()))
            else:  # attempted = "old" questions the student has already seen
                query = query.filter(Question.id.in_(attempted_subq.select()))
        elif status in ("correct", "incorrect"):
            want_correct = status == "correct"
            # Questions whose MOST RECENT attempt matches the wanted correctness.
            # Approximate with "has an attempt with that correctness" — simple and
            # good enough for review; refined by the latest-wins map on display.
            corr_subq = db.query(StudentResponse.question_id).filter(
                StudentResponse.student_id == student_id,
                StudentResponse.is_correct == want_correct,
            ).subquery()
            query = query.filter(Question.id.in_(corr_subq.select()))

    total = query.count()
    questions = (
        query.options(selectinload(Question.explanation))
        .order_by(Question.created_at.desc(), Question.id)
        .offset(offset)
        .limit(limit)
        .all()
    )

    correctness, bm = ({}, set())
    if student_id:
        correctness, bm = _attempt_maps(db, student_id, [q.id for q in questions])

    return {
        "items": questions,
        "total": total,
        "correctness": correctness,   # qid -> bool (latest)
        "bookmarked": bm,             # set of qids
    }


def record_attempt(db: Session, student_id, question: Question, submitted: dict, is_correct: bool):
    """Persist a Question Bank attempt as a session-less StudentResponse."""
    payload = dict(submitted or {})
    payload["_source"] = BANK_SOURCE
    resp = StudentResponse(
        student_id=student_id,
        question_id=question.id,
        test_session_id=None,
        response_json=payload,
        is_correct=is_correct,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(resp)
    db.flush()
    return resp


def add_bookmark(db: Session, student_id, question_id) -> QuestionBookmark:
    existing = (
        db.query(QuestionBookmark)
        .filter(QuestionBookmark.student_id == student_id,
                QuestionBookmark.question_id == question_id)
        .first()
    )
    if existing:
        return existing
    bm = QuestionBookmark(student_id=student_id, question_id=question_id)
    db.add(bm)
    db.flush()
    return bm


def remove_bookmark(db: Session, student_id, question_id) -> bool:
    deleted = (
        db.query(QuestionBookmark)
        .filter(QuestionBookmark.student_id == student_id,
                QuestionBookmark.question_id == question_id)
        .delete(synchronize_session=False)
    )
    return bool(deleted)


def list_bookmark_ids(db: Session, student_id) -> list:
    return [
        str(b.question_id)
        for b in db.query(QuestionBookmark.question_id).filter(
            QuestionBookmark.student_id == student_id
        )
    ]


def my_stats(db: Session, student_id) -> dict:
    """Overall bank-relevant practice stats for the progress strip."""
    total = (
        db.query(func.count(func.distinct(StudentResponse.question_id)))
        .filter(StudentResponse.student_id == student_id)
        .scalar()
    ) or 0
    # Latest-correctness accuracy across distinct questions is heavier to compute;
    # use overall attempt accuracy as a simple, honest headline.
    attempts = (
        db.query(func.count(StudentResponse.id))
        .filter(StudentResponse.student_id == student_id)
        .scalar()
    ) or 0
    correct = (
        db.query(func.count(StudentResponse.id))
        .filter(StudentResponse.student_id == student_id,
                StudentResponse.is_correct == True)  # noqa: E712
        .scalar()
    ) or 0
    bookmarks = (
        db.query(func.count(QuestionBookmark.id))
        .filter(QuestionBookmark.student_id == student_id)
        .scalar()
    ) or 0
    return {
        "distinct_questions_attempted": total,
        "total_attempts": attempts,
        "correct_attempts": correct,
        "accuracy": round(100 * correct / attempts, 1) if attempts else None,
        "bookmarks": bookmarks,
    }
