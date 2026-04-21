"""
SAT Tutoring Platform - Diagnostic Assessment API

Students can self-initiate a diagnostic assessment from the dashboard.
Supports Math only, Reading & Writing only, or both sections.
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.invite import Invite, generate_invite_token
from app.models.test import TestSession, TestQuestion
from app.models.enums import TestType, TestStatus, SubjectArea, InviteStatus, AssessmentType
from app.services.intake_service import select_intake_questions, calculate_intake_results

router = APIRouter()

QUESTIONS_PER_SECTION = 15


class DiagnosticStartRequest(BaseModel):
    sections: List[str] = Field(
        default=["math", "reading_writing"],
        description="Sections to include: 'math', 'reading_writing', or both",
    )


SECTION_MAP = {
    "math": SubjectArea.MATH,
    "reading_writing": SubjectArea.READING_WRITING,
}


@router.post("/start")
def start_diagnostic(
    request: DiagnosticStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Start a self-serve diagnostic assessment.

    Accepts sections: ["math"], ["reading_writing"], or ["math", "reading_writing"].
    Selects 15 questions per section, creates a TestSession and Invite token.
    """
    import traceback

    try:
        # Validate sections
        valid_sections = [s for s in request.sections if s in SECTION_MAP]
        if not valid_sections:
            raise HTTPException(
                status_code=400,
                detail="At least one valid section required: 'math' or 'reading_writing'",
            )

        # Determine subject_area for the session
        if len(valid_sections) == 2:
            session_subject = None  # both
        else:
            session_subject = SECTION_MAP[valid_sections[0]]

        # Check for an existing incomplete diagnostic with same section scope
        existing = (
            db.query(TestSession)
            .filter(
                and_(
                    TestSession.student_id == current_user.id,
                    TestSession.test_type == TestType.DIAGNOSTIC,
                    TestSession.status == TestStatus.IN_PROGRESS,
                    TestSession.subject_area == session_subject,
                )
            )
            .order_by(TestSession.created_at.desc())
            .first()
        )
        if existing:
            invite = db.query(Invite).filter(Invite.test_session_id == existing.id).first()
            if invite:
                return {"token": invite.token, "session_id": str(existing.id), "is_resuming": True}

        # Select questions per section
        section_questions = {}
        for section_key in valid_sections:
            qs = select_intake_questions(
                db=db,
                question_count=QUESTIONS_PER_SECTION,
                subject_area=SECTION_MAP[section_key],
            )
            section_questions[section_key] = qs

        # Flatten — interleave if both sections
        if len(valid_sections) == 2:
            all_questions = []
            math_qs = section_questions.get("math", [])
            rw_qs = section_questions.get("reading_writing", [])
            m_iter, r_iter = iter(math_qs), iter(rw_qs)
            while True:
                added = False
                try:
                    all_questions.append(next(m_iter))
                    added = True
                except StopIteration:
                    pass
                try:
                    all_questions.append(next(r_iter))
                    added = True
                except StopIteration:
                    pass
                if not added:
                    break
        else:
            all_questions = section_questions[valid_sections[0]]

        if not all_questions:
            raise HTTPException(
                status_code=500,
                detail="No questions available for the selected sections",
            )

        total = len(all_questions)

        # Build title
        if len(valid_sections) == 2:
            title = "Diagnostic Assessment"
        elif valid_sections[0] == "math":
            title = "Math Diagnostic"
        else:
            title = "Reading & Writing Diagnostic"

        # Create test session
        session = TestSession(
            student_id=current_user.id,
            test_type=TestType.DIAGNOSTIC,
            status=TestStatus.IN_PROGRESS,
            subject_area=session_subject,
            title=title,
            total_questions=total,
            started_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.flush()

        for i, q in enumerate(all_questions):
            db.add(TestQuestion(
                test_session_id=session.id,
                question_id=q.id,
                question_order=i,
            ))

        invite = Invite(
            token=generate_invite_token(),
            tutor_id=current_user.id,
            student_id=current_user.id,
            title=title,
            subject_area=session_subject,
            question_count=total,
            is_adaptive=0,
            assessment_type=AssessmentType.INTAKE,
            status=InviteStatus.USED,
            test_session_id=session.id,
        )
        db.add(invite)
        db.commit()

        return {
            "token": invite.token,
            "session_id": str(session.id),
            "is_resuming": False,
            "total_questions": total,
            "sections": valid_sections,
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

    type_map = {
        TestType.DIAGNOSTIC: "diagnostic",
        TestType.PRACTICE: "practice",
        TestType.ASSIGNED: "assigned",
    }
    rtype = type_map.get(session.test_type, "assessment")
    return build_results_payload(db, session, results, result_type=rtype)
