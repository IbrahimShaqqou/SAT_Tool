"""
SAT Tutoring Platform - Student Progress API

Endpoints for viewing student progress (minimal student-facing view).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.response import StudentResponse
from app.models.test import TestSession
from app.models.enums import TestStatus
from app.schemas.progress import (
    ProgressSummary,
    ResponseHistoryItem,
    ResponseHistoryResponse,
)

router = APIRouter()


@router.get("/summary", response_model=ProgressSummary)
def get_progress_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressSummary:
    """
    Get student's overall progress summary.

    Returns basic stats: total questions answered, accuracy, sessions completed.
    """
    # Count total responses and correct responses
    total_answered = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == current_user.id,
    ).scalar() or 0

    total_correct = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == current_user.id,
        StudentResponse.is_correct == True,
    ).scalar() or 0

    # Calculate accuracy
    accuracy = (total_correct / total_answered * 100) if total_answered > 0 else 0.0

    # Count completed sessions
    sessions_completed = db.query(func.count(TestSession.id)).filter(
        TestSession.student_id == current_user.id,
        TestSession.status == TestStatus.COMPLETED,
    ).scalar() or 0

    # Get last practice time
    last_response = db.query(StudentResponse.submitted_at).filter(
        StudentResponse.student_id == current_user.id,
    ).order_by(StudentResponse.submitted_at.desc()).first()

    last_practice_at = last_response[0] if last_response else None

    return ProgressSummary(
        total_questions_answered=total_answered,
        total_correct=total_correct,
        overall_accuracy=round(accuracy, 1),
        sessions_completed=sessions_completed,
        last_practice_at=last_practice_at,
    )


@router.get("/history", response_model=ResponseHistoryResponse)
def get_response_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ResponseHistoryResponse:
    """
    Get student's recent response history.

    Returns paginated list of question responses.
    """
    query = db.query(StudentResponse).filter(
        StudentResponse.student_id == current_user.id,
    )

    total = query.count()

    responses = query.order_by(
        StudentResponse.submitted_at.desc()
    ).offset(offset).limit(limit).all()

    items = [
        ResponseHistoryItem(
            id=r.id,
            question_id=r.question_id,
            is_correct=r.is_correct,
            submitted_at=r.submitted_at,
        )
        for r in responses
    ]

    return ResponseHistoryResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )
