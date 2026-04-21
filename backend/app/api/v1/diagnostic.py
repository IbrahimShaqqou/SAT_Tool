"""
SAT Tutoring Platform - Diagnostic Assessment API

Students can self-initiate a diagnostic assessment from the dashboard.
Creates a balanced 30-question session (15 math + 15 R&W) using the
same adaptive question selection as intake assessments.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.invite import Invite, generate_invite_token
from app.models.test import TestSession, TestQuestion
from app.models.enums import TestType, TestStatus, SubjectArea, InviteStatus, AssessmentType
from app.services.intake_service import select_intake_questions, calculate_intake_results

router = APIRouter()

DIAGNOSTIC_MATH_QUESTIONS = 15
DIAGNOSTIC_RW_QUESTIONS = 15


@router.post("/start")
def start_diagnostic(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start a self-serve diagnostic assessment.

    Selects 15 math + 15 R&W questions balanced across skills,
    creates a TestSession and an Invite token for the assess flow.
    Returns { token } for navigating to /assess/{token}.
    """
    import traceback

    try:
        # Check for an existing incomplete diagnostic
        existing = (
            db.query(TestSession)
            .filter(
                and_(
                    TestSession.student_id == current_user.id,
                    TestSession.test_type == TestType.DIAGNOSTIC,
                    TestSession.status == TestStatus.IN_PROGRESS,
                )
            )
            .order_by(TestSession.created_at.desc())
            .first()
        )
        if existing:
            # Find the invite for this session
            invite = db.query(Invite).filter(Invite.test_session_id == existing.id).first()
            if invite:
                return {"token": invite.token, "session_id": str(existing.id), "is_resuming": True}

        # Select questions from both sections
        math_questions = select_intake_questions(
            db=db,
            question_count=DIAGNOSTIC_MATH_QUESTIONS,
            subject_area=SubjectArea.MATH,
        )
        rw_questions = select_intake_questions(
            db=db,
            question_count=DIAGNOSTIC_RW_QUESTIONS,
            subject_area=SubjectArea.READING_WRITING,
        )

        if not math_questions and not rw_questions:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No questions available for diagnostic",
            )

        # Interleave math and R&W questions for a natural mix
        all_questions = []
        math_iter = iter(math_questions)
        rw_iter = iter(rw_questions)
        while True:
            try:
                all_questions.append(next(math_iter))
            except StopIteration:
                pass
            try:
                all_questions.append(next(rw_iter))
            except StopIteration:
                pass
            if len(all_questions) >= len(math_questions) + len(rw_questions):
                break

        total = len(all_questions)

        # Create the test session
        session = TestSession(
            student_id=current_user.id,
            test_type=TestType.DIAGNOSTIC,
            status=TestStatus.IN_PROGRESS,
            subject_area=None,  # covers both
            title="Diagnostic Assessment",
            total_questions=total,
            started_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.flush()

        # Create TestQuestion records
        for i, q in enumerate(all_questions):
            db.add(TestQuestion(
                test_session_id=session.id,
                question_id=q.id,
                question_order=i,
            ))

        # Create an Invite so the existing assess flow can handle the test UI
        # tutor_id = student's own ID (self-serve diagnostic)
        invite = Invite(
            token=generate_invite_token(),
            tutor_id=current_user.id,
            student_id=current_user.id,
            title="Diagnostic Assessment",
            subject_area=None,
            question_count=total,
            is_adaptive=0,  # Questions already selected (Integer column: 0=False)
            assessment_type=AssessmentType.INTAKE,
            status=InviteStatus.USED,  # Pre-used so the start endpoint skips re-selection
            test_session_id=session.id,
        )
        db.add(invite)
        db.commit()

        return {
            "token": invite.token,
            "session_id": str(session.id),
            "is_resuming": False,
            "total_questions": total,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"[DIAGNOSTIC] Error starting diagnostic: {type(exc).__name__}: {exc}")
        print(f"[DIAGNOSTIC] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start diagnostic: {type(exc).__name__}: {str(exc)}",
        )


@router.get("/{session_id}/results")
def get_diagnostic_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get full results for a completed diagnostic session.
    Accessible by the student who took it OR any tutor/admin.
    """
    from uuid import UUID
    from app.services.results_builder import build_results_payload

    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    # Tutors/admins can view any session; students only their own
    if current_user.role in ("tutor", "admin"):
        session = db.query(TestSession).filter(TestSession.id == sid).first()
    else:
        session = db.query(TestSession).filter(
            TestSession.id == sid,
            TestSession.student_id == current_user.id,
        ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != TestStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Diagnostic has not been completed yet")

    results = calculate_intake_results(db, session.id)
    if "error" in results:
        raise HTTPException(status_code=500, detail=results["error"])

    # Use the session's test_type as the result type
    type_map = {
        TestType.DIAGNOSTIC: "diagnostic",
        TestType.PRACTICE: "practice",
        TestType.ASSIGNED: "assigned",
    }
    rtype = type_map.get(session.test_type, "assessment")
    return build_results_payload(db, session, results, result_type=rtype)
