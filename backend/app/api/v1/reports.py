"""
Question Report Endpoint

Lets students flag issues with questions (wrong answer key, broken image, etc.).
Reports are stored in question_reports and visible to tutors/admins for triage.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter()

# ---------------------------------------------------------------------------
# Inline model — small enough not to need its own file
# ---------------------------------------------------------------------------

class QuestionReport(Base):
    __tablename__ = "question_reports"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    reason = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

VALID_REASONS = {
    "wrong_answer",
    "broken_image",
    "typo_or_formatting",
    "unclear_question",
    "other",
}


class ReportCreate(BaseModel):
    reason: str = Field(..., description="One of: wrong_answer, broken_image, typo_or_formatting, unclear_question, other")
    notes: Optional[str] = Field(None, max_length=500)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/questions/{question_id}/report", status_code=201)
def report_question(
    question_id: int,
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.reason not in VALID_REASONS:
        raise HTTPException(status_code=422, detail=f"Invalid reason. Must be one of: {', '.join(sorted(VALID_REASONS))}")

    # Verify the question exists
    row = db.execute(text("SELECT id FROM questions WHERE id = :qid"), {"qid": question_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")

    report = QuestionReport(
        question_id=question_id,
        reported_by=current_user.id,
        reason=body.reason,
        notes=body.notes,
    )
    db.add(report)
    db.commit()

    return {"status": "reported", "question_id": question_id}


@router.get("/questions/reports")
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all reports — tutor/admin use only."""
    if current_user.role not in ("tutor", "admin"):
        raise HTTPException(status_code=403, detail="Tutors only")

    rows = db.execute(text("""
        SELECT
            qr.id,
            qr.question_id,
            qr.reason,
            qr.notes,
            qr.created_at,
            u.email AS reporter_email,
            u.full_name AS reporter_name
        FROM question_reports qr
        LEFT JOIN users u ON u.id = qr.reported_by
        ORDER BY qr.created_at DESC
        LIMIT 200
    """)).fetchall()

    return [dict(r._mapping) for r in rows]
