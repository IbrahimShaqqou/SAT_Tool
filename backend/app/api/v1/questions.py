"""
SAT Tutoring Platform - Questions API

Endpoints for browsing and retrieving SAT questions.
"""

from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.question import Question
from app.models.question_explanation import QuestionExplanation
from app.models.enums import AnswerType, DifficultyLevel, SubjectArea
from app.schemas.question import (
    QuestionBrief,
    QuestionDetail,
    QuestionDetailListResponse,
    QuestionListResponse,
    QuestionRandomResponse,
)
from app.schemas.explanation import ExplanationResponse, StepByStepExplanation
from app.services import question_bank_service as qbank
from app.services.answer_checker import check_answer

router = APIRouter()


@router.get("", response_model=Union[QuestionListResponse, QuestionDetailListResponse])
def list_questions(
    db: Session = Depends(get_db),
    subject: Optional[SubjectArea] = Query(None, description="Filter by subject area"),
    domain_id: Optional[int] = Query(None, description="Filter by domain ID"),
    skill_id: Optional[int] = Query(None, description="Filter by skill ID"),
    difficulty: Optional[DifficultyLevel] = Query(None, description="Filter by difficulty"),
    answer_type: Optional[AnswerType] = Query(None, description="Filter by answer type"),
    full: bool = Query(False, description="Return full question details including choices and explanations"),
    limit: int = Query(50, ge=1, le=500, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
) -> Union[QuestionListResponse, QuestionDetailListResponse]:
    """
    List questions with optional filters.

    By default returns a paginated list of questions without explanations.
    Use full=true to get complete question details including choices and explanations.
    """
    # Base query - only active, non-deleted questions
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
    )

    # Apply filters
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

    # Get total count before pagination
    total = query.count()

    # Apply pagination and fetch
    questions = query.options(selectinload(Question.explanation)).order_by(Question.created_at.desc(), Question.id).offset(offset).limit(limit).all()

    # Return full details or brief based on parameter
    if full:
        return QuestionDetailListResponse(
            items=[QuestionDetail.from_orm_with_choices(q) for q in questions],
            total=total,
            limit=limit,
            offset=offset,
        )
    else:
        return QuestionListResponse(
            items=[QuestionBrief.from_orm_with_choices(q) for q in questions],
            total=total,
            limit=limit,
            offset=offset,
        )


@router.get("/random", response_model=QuestionRandomResponse)
def get_random_questions(
    db: Session = Depends(get_db),
    count: int = Query(1, ge=1, le=10, description="Number of random questions"),
    subject: Optional[SubjectArea] = Query(None, description="Filter by subject area"),
    domain_id: Optional[int] = Query(None, description="Filter by domain ID"),
    skill_id: Optional[int] = Query(None, description="Filter by skill ID"),
    difficulty: Optional[DifficultyLevel] = Query(None, description="Filter by difficulty"),
    answer_type: Optional[AnswerType] = Query(None, description="Filter by answer type"),
) -> QuestionRandomResponse:
    """
    Get random question(s) matching filters.

    Returns full question details including explanation.
    Useful for practice sessions and quick quizzes.
    """
    # Base query - only active, non-deleted questions
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
    )

    # Apply filters
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

    # Get random questions using PostgreSQL RANDOM()
    questions = query.order_by(func.random()).limit(count).all()

    return QuestionRandomResponse(
        items=[QuestionDetail.from_orm_with_choices(q) for q in questions]
    )


@router.get("/{question_id}", response_model=QuestionDetail)
def get_question(
    question_id: UUID,
    db: Session = Depends(get_db),
) -> QuestionDetail:
    """
    Get a single question by ID with full details.

    Returns the complete question including choices and explanation.
    """
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.is_active == True,
        Question.deleted_at == None,
    ).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    return QuestionDetail.from_orm_with_choices(question)


@router.post("/{question_id}/check")
def check_question_answer(
    question_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Check an answer for a question (used by Question Bank practice mode).
    Returns is_correct, correct_answer, and explanation.
    """
    from app.services.answer_checker import check_answer

    question = db.query(Question).filter(
        Question.id == question_id,
        Question.is_active == True,
    ).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    is_correct = check_answer(
        question.correct_answer_json, payload.get("answer", {}), question.answer_type.value
    )

    explanation = question.explanation_html
    if not explanation and question.raw_import_json:
        explanation = question.raw_import_json.get("rationale_html")

    return {
        "is_correct": is_correct,
        "correct_answer": question.correct_answer_json,
        "explanation_html": explanation,
        "explanation_available": question.explanation is not None,
    }


# ===== Question Bank (authenticated, study-oriented) =====
# Static "/bank/..." paths are declared with a prefix so they never collide with
# the "/{question_id}" routes above.

class BankBrowseItem(BaseModel):
    id: str
    external_id: Optional[str] = None
    subject_area: str
    domain: Optional[str] = None
    skill: Optional[str] = None
    skill_id: Optional[int] = None
    difficulty: Optional[str] = None
    answer_type: str
    prompt_snippet: str
    status: str          # untried | correct | incorrect
    bookmarked: bool


class BankBrowseResponse(BaseModel):
    items: List[BankBrowseItem]
    total: int
    limit: int
    offset: int


def _snippet(html: Optional[str], n: int = 160) -> str:
    import re
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:n] + ("…" if len(text) > n else "")


@router.get("/bank/browse", response_model=BankBrowseResponse, tags=["Question Bank"])
def bank_browse(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    subject: Optional[SubjectArea] = Query(None),
    domain_id: Optional[int] = Query(None),
    skill_id: Optional[int] = Query(None),
    difficulty: Optional[DifficultyLevel] = Query(None),
    answer_type: Optional[AnswerType] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    bookmarked: bool = Query(False),
    q: Optional[str] = Query(None),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Filterable, per-student Question Bank browse (cards)."""
    result = qbank.list_questions(
        db,
        student_id=current_user.id,
        subject=subject, domain_id=domain_id, skill_id=skill_id,
        difficulty=difficulty, answer_type=answer_type,
        status=status_filter, bookmarked=bookmarked, search=q,
        limit=limit, offset=offset,
    )
    correctness = result["correctness"]
    bm = result["bookmarked"]
    items = []
    for question in result["items"]:
        if question.id in correctness:
            st = "correct" if correctness[question.id] else "incorrect"
        else:
            st = "untried"
        items.append(BankBrowseItem(
            id=str(question.id),
            external_id=question.external_id,
            subject_area=question.subject_area.value,
            domain=question.domain.name if getattr(question, "domain", None) else None,
            skill=question.skill.name if getattr(question, "skill", None) else None,
            skill_id=question.skill_id,
            difficulty=question.difficulty.value if question.difficulty else None,
            answer_type=question.answer_type.value,
            prompt_snippet=_snippet(question.prompt_html),
            status=st,
            bookmarked=question.id in bm,
        ))
    return BankBrowseResponse(items=items, total=result["total"], limit=limit, offset=offset)


@router.post("/{question_id}/attempt", tags=["Question Bank"])
def bank_attempt(
    question_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a logged-in student's Question Bank attempt + return result."""
    question = db.query(Question).filter(
        Question.id == question_id, Question.is_active == True,  # noqa: E712
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    submitted = payload.get("answer", {}) or {}
    is_correct = check_answer(question.correct_answer_json, submitted, question.answer_type.value)
    qbank.record_attempt(db, current_user.id, question, submitted, is_correct)
    db.commit()

    explanation = question.explanation_html
    if not explanation and question.raw_import_json:
        explanation = question.raw_import_json.get("rationale_html")
    return {
        "is_correct": is_correct,
        "correct_answer": question.correct_answer_json,
        "explanation_html": explanation,
        "explanation_available": question.explanation is not None,
    }


@router.get("/bank/bookmarks", tags=["Question Bank"])
def bank_list_bookmarks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"question_ids": qbank.list_bookmark_ids(db, current_user.id)}


@router.post("/{question_id}/bookmark", tags=["Question Bank"])
def bank_add_bookmark(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Question).filter(Question.id == question_id).first():
        raise HTTPException(status_code=404, detail="Question not found")
    qbank.add_bookmark(db, current_user.id, question_id)
    db.commit()
    return {"bookmarked": True}


@router.delete("/{question_id}/bookmark", tags=["Question Bank"])
def bank_remove_bookmark(
    question_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    qbank.remove_bookmark(db, current_user.id, question_id)
    db.commit()
    return {"bookmarked": False}


@router.get("/bank/my-stats", tags=["Question Bank"])
def bank_my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return qbank.my_stats(db, current_user.id)


@router.get("/{question_id}/explanation", response_model=ExplanationResponse)
def get_question_explanation(
    question_id: UUID,
    db: Session = Depends(get_db),
) -> ExplanationResponse:
    """
    Get the step-by-step explanation for a question.

    Returns 404 if no explanation has been generated yet.
    """
    expl = db.query(QuestionExplanation).filter(
        QuestionExplanation.question_id == question_id,
    ).first()

    if not expl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No explanation found for this question",
        )

    return ExplanationResponse(
        question_id=expl.question_id,
        explanation_type=expl.explanation_type,
        data=StepByStepExplanation.model_validate(expl.steps_json),
        model_used=expl.model_used,
        is_approved=expl.is_approved,
    )
