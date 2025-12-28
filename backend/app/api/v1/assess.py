"""
SAT Tutoring Platform - Public Assessment API

Public endpoints for students to take assessments via invite links.
No authentication required.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.models.question import Question
from app.models.taxonomy import Skill
from app.models.invite import Invite
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse, StudentSkill
from app.models.enums import InviteStatus, TestType, TestStatus, SubjectArea
from app.schemas.invite import (
    AssessmentConfig,
    AssessmentStart,
    AssessmentStartResponse,
    AssessmentQuestion,
    AssessmentQuestionsResponse,
    AssessmentAnswerSubmit,
    AssessmentAnswerResult,
    AssessmentComplete,
)

router = APIRouter()


def _get_valid_invite(token: str, db: Session) -> Invite:
    """Get an invite by token and validate it's usable."""
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    # Check if expired (use utcnow for naive datetime comparison)
    if invite.expires_at and datetime.utcnow() > invite.expires_at:
        if invite.status == InviteStatus.ACTIVE:
            invite.status = InviteStatus.EXPIRED
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This assessment link has expired",
        )

    if invite.status == InviteStatus.REVOKED:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This assessment link has been revoked",
        )

    if invite.status == InviteStatus.USED:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This assessment link has already been used",
        )

    return invite


@router.get("/{token}", response_model=AssessmentConfig)
def get_assessment_config(
    token: str,
    db: Session = Depends(get_db),
) -> AssessmentConfig:
    """
    Get assessment configuration for an invite link.
    This is called when a student opens an invite link to see what they're about to take.
    """
    invite = _get_valid_invite(token, db)

    # Get tutor name
    tutor = db.query(User).filter(User.id == invite.tutor_id).first()
    tutor_name = f"{tutor.first_name} {tutor.last_name}" if tutor else "Your Tutor"

    return AssessmentConfig(
        token=invite.token,
        title=invite.title,
        subject_area=invite.subject_area,
        question_count=invite.question_count,
        time_limit_minutes=invite.time_limit_minutes,
        tutor_name=tutor_name,
    )


@router.post("/{token}/start", response_model=AssessmentStartResponse)
def start_assessment(
    token: str,
    request: AssessmentStart,
    db: Session = Depends(get_db),
) -> AssessmentStartResponse:
    """
    Start an assessment.
    Creates a test session and selects questions.
    """
    invite = _get_valid_invite(token, db)

    # Build question query (filter out soft-deleted questions)
    query = db.query(Question).filter(Question.deleted_at == None)

    if invite.subject_area:
        query = query.filter(Question.subject_area == invite.subject_area)

    # Get random questions
    questions = query.order_by(func.random()).limit(invite.question_count).all()

    if len(questions) < invite.question_count:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Not enough questions available. Found {len(questions)}, need {invite.question_count}",
        )

    # Create test session
    session = TestSession(
        student_id=None,  # Guest assessment
        test_type=TestType.DIAGNOSTIC,
        status=TestStatus.IN_PROGRESS,
        subject_area=invite.subject_area,
        title=invite.title or "Assessment",
        total_questions=len(questions),
        time_limit_minutes=invite.time_limit_minutes,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()

    # Create test questions
    for i, q in enumerate(questions):
        tq = TestQuestion(
            test_session_id=session.id,
            question_id=q.id,
            question_order=i,
        )
        db.add(tq)

    # Mark invite as used and link to session
    invite.status = InviteStatus.USED
    invite.used_at = datetime.now(timezone.utc)
    invite.guest_name = request.guest_name
    invite.guest_email = request.guest_email
    invite.test_session_id = session.id

    db.commit()
    db.refresh(session)

    return AssessmentStartResponse(
        session_id=session.id,
        total_questions=session.total_questions,
        time_limit_minutes=session.time_limit_minutes,
    )


@router.get("/{token}/questions", response_model=AssessmentQuestionsResponse)
def get_assessment_questions(
    token: str,
    db: Session = Depends(get_db),
) -> AssessmentQuestionsResponse:
    """
    Get all questions for an in-progress assessment.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    if not invite.test_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment has not been started",
        )

    session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.status == TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment has already been completed",
        )

    # Get questions in order
    test_questions = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id
    ).order_by(TestQuestion.question_order).all()

    questions = []
    for tq in test_questions:
        q = db.query(Question).filter(Question.id == tq.question_id).first()
        if q:
            prompt = q.prompt_html
            passage_html = None

            # Handle stimulus/passage from raw_import_json
            if q.raw_import_json and isinstance(q.raw_import_json, dict):
                stimulus = q.raw_import_json.get("stimulus_html")
                raw_prompt = q.raw_import_json.get("prompt_html")

                if stimulus:
                    # For Reading/Writing, use separate prompt and passage to avoid duplication
                    # raw_prompt has only the question, stimulus has the passage
                    if q.subject_area and q.subject_area.value == "reading_writing":
                        passage_html = stimulus
                        # Use raw prompt if available (question only, no stimulus)
                        if raw_prompt:
                            prompt = raw_prompt
                    else:
                        # For Math, stimulus is short (equations), keep combined in prompt
                        # Database prompt_html should already have it, but ensure it does
                        if stimulus not in prompt:
                            prompt = f"{stimulus}\n\n{prompt}"

            # Get choices for MCQ
            choices = None
            if q.choices_json:
                choices = [
                    {"index": i, "content": c if isinstance(c, str) else c.get("content", "")}
                    for i, c in enumerate(q.choices_json)
                ]

            questions.append(AssessmentQuestion(
                order=tq.question_order,
                question_id=q.id,
                prompt_html=prompt,
                passage_html=passage_html,
                answer_type=q.answer_type.value,
                choices=choices,
            ))

    return AssessmentQuestionsResponse(
        session_id=session.id,
        total_questions=session.total_questions,
        time_limit_minutes=session.time_limit_minutes,
        questions=questions,
    )


@router.post("/{token}/answer", response_model=AssessmentAnswerResult)
def submit_answer(
    token: str,
    request: AssessmentAnswerSubmit,
    db: Session = Depends(get_db),
) -> AssessmentAnswerResult:
    """
    Submit an answer for a question in the assessment.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite or not invite.test_session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment session not found",
        )

    session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()

    if not session or session.status == TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not in progress",
        )

    # Get the question
    question = db.query(Question).filter(Question.id == request.question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    # Verify question is part of this session
    test_question = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id,
        TestQuestion.question_id == request.question_id,
    ).first()

    if not test_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question not part of this assessment",
        )

    # Check if already answered
    existing_response = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session.id,
        StudentResponse.question_id == request.question_id,
    ).first()

    if existing_response:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question already answered",
        )

    # Check correctness
    correct_answer = question.correct_answer_json
    is_correct = False

    if question.answer_type.value == "MCQ":
        submitted_index = request.answer.get("index")
        correct_index = correct_answer.get("index") if correct_answer else None
        is_correct = submitted_index == correct_index
    else:  # SPR
        submitted_answer = str(request.answer.get("answer", "")).strip().lower()
        correct_answers = correct_answer.get("answers", []) if correct_answer else []
        is_correct = submitted_answer in [str(a).strip().lower() for a in correct_answers]

    # Create response record (no student_id for guest)
    response = StudentResponse(
        student_id=None,
        question_id=question.id,
        test_session_id=session.id,
        response_json=request.answer,
        is_correct=is_correct,
        time_spent_seconds=request.time_spent_seconds,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(response)

    # Update test question
    test_question.is_answered = True

    # Update session stats
    session.questions_answered = (session.questions_answered or 0) + 1
    if is_correct:
        session.questions_correct = (session.questions_correct or 0) + 1

    db.commit()

    # Get explanation
    explanation = question.explanation_html
    if not explanation and question.raw_import_json:
        explanation = question.raw_import_json.get("rationale_html")

    return AssessmentAnswerResult(
        is_correct=is_correct,
        correct_answer=correct_answer or {},
        explanation_html=explanation,
    )


@router.post("/{token}/submit", response_model=AssessmentComplete)
def submit_assessment(
    token: str,
    db: Session = Depends(get_db),
) -> AssessmentComplete:
    """
    Complete and submit the entire assessment.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite or not invite.test_session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment session not found",
        )

    session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.status == TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment already submitted",
        )

    # Calculate final stats
    total = session.total_questions or 1
    correct = session.questions_correct or 0
    score_percentage = (correct / total) * 100

    # Calculate time spent
    time_spent = 0
    if session.started_at:
        time_spent = int((datetime.now(timezone.utc) - session.started_at).total_seconds())

    # Update session
    session.status = TestStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    session.score_percentage = score_percentage
    session.time_spent_seconds = time_spent

    db.commit()

    return AssessmentComplete(
        score_percentage=round(score_percentage, 1),
        questions_correct=correct,
        total_questions=total,
        time_spent_seconds=time_spent,
    )
