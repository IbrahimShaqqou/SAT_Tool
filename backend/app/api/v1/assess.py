"""
SAT Tutoring Platform - Public Assessment API

Public endpoints for students to take assessments via invite links.
No authentication required.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.models.question import Question
from app.models.taxonomy import Skill, Domain
from app.models.invite import Invite
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse, StudentSkill
from app.models.enums import InviteStatus, TestType, TestStatus, SubjectArea, AssessmentType
from app.schemas.invite import (
    AssessmentConfig,
    AssessmentStart,
    AssessmentStartResponse,
    AssessmentQuestion,
    AssessmentQuestionsResponse,
    AssessmentAnswerSubmit,
    AssessmentAnswerResult,
    AssessmentComplete,
    IntakeResultsResponse,
    DomainResult,
    SectionResult,
    PriorityArea,
)
from app.services.intake_service import (
    select_intake_questions,
    calculate_intake_results,
    store_intake_abilities,
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
    authorization: str = Header(None),
) -> AssessmentConfig:
    """
    Get assessment configuration for an invite link.
    Also checks for an existing in-progress session to resume.
    """
    # Don't validate status here - allow checking used invites for resume
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    # Check if expired
    if invite.expires_at and datetime.utcnow() > invite.expires_at:
        if invite.status == InviteStatus.ACTIVE:
            invite.status = InviteStatus.EXPIRED
            db.commit()

    if invite.status == InviteStatus.REVOKED:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This assessment link has been revoked",
        )

    if invite.status == InviteStatus.EXPIRED:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This assessment link has expired",
        )

    # Get tutor name
    tutor = db.query(User).filter(User.id == invite.tutor_id).first()
    tutor_name = f"{tutor.first_name} {tutor.last_name}" if tutor else "Your Tutor"

    # Check for in-progress session
    has_session = False
    session_id = None
    questions_answered = 0
    current_question_index = 0

    if invite.test_session_id:
        session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()
        if session and session.status == TestStatus.IN_PROGRESS:
            has_session = True
            session_id = session.id
            questions_answered = session.questions_answered or 0
            current_question_index = session.current_question_index or 0

    return AssessmentConfig(
        token=invite.token,
        title=invite.title,
        subject_area=invite.subject_area,
        question_count=invite.question_count,
        time_limit_minutes=invite.time_limit_minutes,
        tutor_name=tutor_name,
        has_in_progress_session=has_session,
        session_id=session_id,
        questions_answered=questions_answered,
        current_question_index=current_question_index,
    )


@router.post("/{token}/start", response_model=AssessmentStartResponse)
def start_assessment(
    token: str,
    request: AssessmentStart,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
) -> AssessmentStartResponse:
    """
    Start or resume an assessment.
    If there's an existing in-progress session, returns it for resume.
    Otherwise creates a new test session and selects questions.
    If user is authenticated, links session to their account.
    """
    from app.core.security import decode_access_token

    # Check if user is authenticated first
    current_user = None
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization[7:]
        try:
            payload = decode_access_token(token_str)
            if payload:
                user_id = payload.get("sub")
                if user_id:
                    current_user = db.query(User).filter(User.id == user_id).first()
        except Exception:
            pass  # Invalid token, proceed as guest

    # Get invite (allow "used" status for resume)
    invite = db.query(Invite).filter(Invite.token == token).first()
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Check for existing in-progress session to resume
    if invite.test_session_id:
        session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()
        if session and session.status == TestStatus.IN_PROGRESS:
            # Calculate time remaining if timed
            time_remaining = None
            if session.time_limit_minutes and session.started_at:
                elapsed = (datetime.now(timezone.utc) - session.started_at).total_seconds()
                time_remaining = max(0, int(session.time_limit_minutes * 60 - elapsed))

            return AssessmentStartResponse(
                session_id=session.id,
                total_questions=session.total_questions,
                time_limit_minutes=session.time_limit_minutes,
                is_resuming=True,
                current_question_index=session.current_question_index or 0,
                time_remaining_seconds=time_remaining,
            )
        elif session and session.status == TestStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="This assessment has already been completed",
            )

    # Validate invite for new session
    if invite.status == InviteStatus.USED and not invite.test_session_id:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This link has already been used")
    if invite.status == InviteStatus.REVOKED:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This link has been revoked")
    if invite.status == InviteStatus.EXPIRED:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This link has expired")

    # Determine if we should use adaptive selection
    use_adaptive = getattr(invite, 'is_adaptive', True)
    assessment_type = getattr(invite, 'assessment_type', AssessmentType.INTAKE)

    if use_adaptive and assessment_type == AssessmentType.INTAKE:
        # Use CAT-style adaptive selection for intake assessments
        questions = select_intake_questions(
            db=db,
            question_count=invite.question_count,
            subject_area=invite.subject_area,
        )
    else:
        # Fallback to random selection for non-adaptive assessments
        query = db.query(Question).filter(Question.deleted_at == None)

        if invite.subject_area:
            query = query.filter(Question.subject_area == invite.subject_area)

        questions = query.order_by(func.random()).limit(invite.question_count).all()

    if len(questions) < invite.question_count:
        # If we don't have enough questions, get what we can
        if len(questions) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"No questions available for this assessment",
            )
        # Otherwise proceed with what we have

    # Create test session (linked to student if authenticated)
    test_type = TestType.DIAGNOSTIC if assessment_type == AssessmentType.INTAKE else TestType.PRACTICE
    session = TestSession(
        student_id=current_user.id if current_user else None,
        test_type=test_type,
        status=TestStatus.IN_PROGRESS,
        subject_area=invite.subject_area,
        title=invite.title or ("Intake Assessment" if assessment_type == AssessmentType.INTAKE else "Assessment"),
        total_questions=len(questions),
        time_limit_minutes=invite.time_limit_minutes,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()

    # Create test questions in the selected order
    for i, q in enumerate(questions):
        tq = TestQuestion(
            test_session_id=session.id,
            question_id=q.id,
            question_order=i,
        )
        db.add(tq)

    # Mark invite as used and link to session/student
    invite.status = InviteStatus.USED
    invite.used_at = datetime.now(timezone.utc)
    invite.test_session_id = session.id

    # Link to student if authenticated, otherwise store guest info
    if current_user:
        invite.student_id = current_user.id
        # Auto-onboard: assign student to tutor if not already assigned
        if current_user.tutor_id is None and invite.tutor_id:
            current_user.tutor_id = invite.tutor_id
    else:
        invite.guest_name = request.guest_name
        invite.guest_email = request.guest_email

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

    # Create response record (link to student if available)
    student_id = invite.student_id or session.student_id
    response = StudentResponse(
        student_id=student_id,
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
    Stores skill abilities to student profile if student is authenticated.
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

    # Store skill abilities to student profile (if student is authenticated)
    student_id = invite.student_id or session.student_id
    if student_id:
        try:
            result = store_intake_abilities(db, student_id, session.id)
            print(f"Intake abilities stored: {result}")
        except Exception as e:
            # Log but don't fail the submission
            import traceback
            print(f"Warning: Failed to store intake abilities: {e}")
            traceback.print_exc()
    else:
        print(f"Skipping ability storage: no student_id (invite.student_id={invite.student_id}, session.student_id={session.student_id})")

    db.commit()

    return AssessmentComplete(
        score_percentage=round(score_percentage, 1),
        questions_correct=correct,
        total_questions=total,
        time_spent_seconds=time_spent,
    )


@router.get("/{token}/results", response_model=IntakeResultsResponse)
def get_intake_results(
    token: str,
    db: Session = Depends(get_db),
) -> IntakeResultsResponse:
    """
    Get detailed results for a completed intake assessment.

    Returns per-domain ability estimates, predicted SAT scores,
    and priority areas for study.
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

    if session.status != TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment has not been completed yet",
        )

    # Calculate detailed results
    results = calculate_intake_results(db, session.id)

    if "error" in results:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=results["error"],
        )

    # Convert to response models
    section_abilities = [
        SectionResult(
            section=s["section"],
            theta=s["theta"],
            correct=s["correct"],
            total=s["total"],
            accuracy=s["accuracy"],
            predicted_score_low=s["predicted_score_low"],
            predicted_score_mid=s["predicted_score_mid"],
            predicted_score_high=s["predicted_score_high"],
        )
        for s in results.get("section_abilities", [])
    ]

    domain_abilities = [
        DomainResult(
            domain_id=d["domain_id"],
            domain_name=d["domain_name"],
            domain_code=d["domain_code"],
            section=d["section"],
            theta=d["theta"],
            se=d["se"],
            correct=d["correct"],
            total=d["total"],
            accuracy=d["accuracy"],
        )
        for d in results.get("domain_abilities", [])
    ]

    priority_areas = [
        PriorityArea(
            domain_name=p["domain_name"],
            current_level=p["current_level"],
            recommendation=p["recommendation"],
        )
        for p in results.get("priority_areas", [])
    ]

    composite = results.get("predicted_composite")
    predicted_composite = None
    if composite:
        from app.schemas.invite import CompositeScore
        predicted_composite = CompositeScore(
            low=composite["low"],
            mid=composite["mid"],
            high=composite["high"],
        )

    return IntakeResultsResponse(
        overall=results.get("overall", {}),
        section_abilities=section_abilities,
        domain_abilities=domain_abilities,
        priority_areas=priority_areas,
        predicted_composite=predicted_composite,
    )


@router.get("/{token}/answers")
def get_answered_questions(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Get all answered questions for session resume.
    Returns question IDs with their submitted answers and correctness.
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

    # Get all responses for this session
    responses = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session.id
    ).all()

    # Get flagged questions
    flagged = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id,
        TestQuestion.is_flagged == True
    ).all()

    # Build answers dict with correct_answer and explanation for each
    answers_dict = {}
    for r in responses:
        question = db.query(Question).filter(Question.id == r.question_id).first()
        correct_answer = question.correct_answer_json if question else {}
        explanation = question.explanation_html if question else None
        if not explanation and question and question.raw_import_json:
            explanation = question.raw_import_json.get("rationale_html")

        answers_dict[str(r.question_id)] = {
            "answer": r.response_json,
            "is_correct": r.is_correct,
            "correct_answer": correct_answer,
            "explanation_html": explanation,
        }

    return {
        "session_id": session.id,
        "current_question_index": session.current_question_index or 0,
        "answers": answers_dict,
        "flagged_question_ids": [str(tq.question_id) for tq in flagged],
    }


@router.post("/{token}/state")
def update_session_state(
    token: str,
    current_index: int = None,
    db: Session = Depends(get_db),
):
    """
    Update session state (current question position).
    Called when navigating between questions.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite or not invite.test_session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment session not found",
        )

    session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()

    if not session or session.status != TestStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment is not in progress",
        )

    if current_index is not None:
        session.current_question_index = current_index

    db.commit()

    return {"status": "ok", "current_question_index": session.current_question_index}


@router.post("/{token}/flag/{question_id}")
def toggle_question_flag(
    token: str,
    question_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Toggle flag status for a question.
    """
    invite = db.query(Invite).filter(Invite.token == token).first()

    if not invite or not invite.test_session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment session not found",
        )

    test_question = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == invite.test_session_id,
        TestQuestion.question_id == question_id,
    ).first()

    if not test_question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this assessment",
        )

    test_question.is_flagged = not test_question.is_flagged
    db.commit()

    return {"is_flagged": test_question.is_flagged}


@router.get("/{token}/review")
def get_question_review(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Get full question-by-question review for a completed assessment.
    Returns all questions with student answers, correct answers, explanations,
    and skill/domain information.
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

    if session.status != TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment has not been completed yet",
        )

    # Get test questions in order
    test_questions = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id
    ).order_by(TestQuestion.question_order).all()

    # Get all responses
    responses = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session.id
    ).all()
    response_map = {str(r.question_id): r for r in responses}

    questions_review = []
    for tq in test_questions:
        q = db.query(Question).filter(Question.id == tq.question_id).first()
        if not q:
            continue

        response = response_map.get(str(q.id))

        # Get skill and domain info
        skill_name = None
        domain_name = None
        domain_code = None
        if q.skill_id:
            skill = db.query(Skill).filter(Skill.id == q.skill_id).first()
            if skill:
                skill_name = skill.name
        if q.domain_id:
            domain = db.query(Domain).filter(Domain.id == q.domain_id).first()
            if domain:
                domain_name = domain.name
                domain_code = domain.code

        # Get prompt and handle stimulus
        prompt = q.prompt_html
        passage_html = None
        if q.raw_import_json and isinstance(q.raw_import_json, dict):
            stimulus = q.raw_import_json.get("stimulus_html")
            raw_prompt = q.raw_import_json.get("prompt_html")
            if stimulus:
                if q.subject_area and q.subject_area.value == "reading_writing":
                    passage_html = stimulus
                    if raw_prompt:
                        prompt = raw_prompt
                else:
                    if stimulus not in prompt:
                        prompt = f"{stimulus}\n\n{prompt}"

        # Get choices
        choices = None
        if q.choices_json:
            choices = [
                {"index": i, "content": c if isinstance(c, str) else c.get("content", "")}
                for i, c in enumerate(q.choices_json)
            ]

        # Get explanation
        explanation = q.explanation_html
        if not explanation and q.raw_import_json:
            explanation = q.raw_import_json.get("rationale_html")

        questions_review.append({
            "order": tq.question_order,
            "question_id": str(q.id),
            "prompt_html": prompt,
            "passage_html": passage_html,
            "answer_type": q.answer_type.value,
            "choices": choices,
            "student_answer": response.response_json if response else None,
            "correct_answer": q.correct_answer_json,
            "is_correct": response.is_correct if response else False,
            "explanation_html": explanation,
            "skill_name": skill_name,
            "domain_name": domain_name,
            "domain_code": domain_code,
            "time_spent_seconds": response.time_spent_seconds if response else 0,
        })

    return {
        "session_id": str(session.id),
        "total_questions": session.total_questions,
        "questions_correct": session.questions_correct or 0,
        "score_percentage": session.score_percentage or 0,
        "time_spent_seconds": session.time_spent_seconds or 0,
        "questions": questions_review,
    }
