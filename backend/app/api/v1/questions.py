"""
SAT Tutoring Platform - Questions API

Endpoints for browsing and retrieving SAT questions.
"""

from typing import Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.question import Question
from app.models.enums import AnswerType, DifficultyLevel, SubjectArea
from app.schemas.question import (
    QuestionBrief,
    QuestionDetail,
    QuestionDetailListResponse,
    QuestionListResponse,
    QuestionRandomResponse,
)

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
    questions = query.order_by(Question.created_at.desc()).offset(offset).limit(limit).all()

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
            items=[QuestionBrief.model_validate(q) for q in questions],
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
