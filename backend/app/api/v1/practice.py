"""
SAT Tutoring Platform - Practice Sessions API

Endpoints for creating and managing practice test sessions.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse
from app.models.enums import TestType, TestStatus, SubjectArea
from app.schemas.practice import (
    PracticeSessionCreate,
    PracticeSessionBrief,
    PracticeSessionListResponse,
    PracticeSessionDetail,
    QuestionInSession,
    CurrentQuestion,
    AnswerSubmit,
    AnswerResult,
    SessionStatusUpdate,
    SessionComplete,
    SessionResults,
    QuestionResult,
    SkillBreakdown,
)
from app.schemas.question import ChoiceOption, DomainBrief, SkillBrief
from app.services.irt_service import (
    update_skill_ability,
    propagate_ability_updates,
    DEFAULT_A,
    DEFAULT_B,
    DEFAULT_C_MCQ,
)
from app.models.response import StudentSkill
from app.models.enums import AnswerType

router = APIRouter()


def _get_session_or_404(
    session_id: UUID,
    user_id: UUID,
    db: Session,
) -> TestSession:
    """Get a practice session by ID, ensuring it belongs to the user."""
    session = db.query(TestSession).filter(
        TestSession.id == session_id,
        TestSession.student_id == user_id,
        TestSession.test_type == TestType.PRACTICE,
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice session not found",
        )
    return session


def _check_answer(question: Question, submitted_answer: dict) -> bool:
    """Check if submitted answer is correct."""
    correct = question.correct_answer_json

    # MCQ: Compare index
    if "index" in submitted_answer and "index" in correct:
        return submitted_answer["index"] == correct["index"]

    # SPR: Compare answer string(s)
    if "answer" in submitted_answer and "answers" in correct:
        user_answer = str(submitted_answer["answer"]).strip().lower()
        correct_answers = [str(a).strip().lower() for a in correct["answers"]]
        return user_answer in correct_answers

    return False


def _get_skill_responses(db: Session, student_id: UUID, skill_id: int) -> list:
    """Get all responses for a student-skill pair with IRT parameters."""
    from app.models.response import StudentResponse

    responses = db.query(StudentResponse).join(
        Question, StudentResponse.question_id == Question.id
    ).filter(
        StudentResponse.student_id == student_id,
        Question.skill_id == skill_id,
    ).all()

    result = []
    for r in responses:
        q = r.question
        result.append({
            "a": q.irt_discrimination_a or DEFAULT_A,
            "b": q.irt_difficulty_b or DEFAULT_B,
            "c": q.irt_guessing_c if q.irt_guessing_c is not None else (
                DEFAULT_C_MCQ if q.answer_type == AnswerType.MCQ else 0.0
            ),
            "is_correct": r.is_correct,
        })

    return result


@router.post("", response_model=PracticeSessionBrief, status_code=status.HTTP_201_CREATED)
def create_practice_session(
    session_data: PracticeSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PracticeSessionBrief:
    """
    Create a new practice session.

    Selects random questions based on the specified filters and creates
    a new practice session for the authenticated user.
    """
    # Build query for question selection
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
        Question.subject_area == session_data.subject,
    )

    # Apply optional filters
    if session_data.domain_id:
        domain = db.query(Domain).filter(Domain.id == session_data.domain_id).first()
        if not domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Domain not found",
            )
        query = query.filter(Question.domain_id == session_data.domain_id)

    if session_data.skill_id:
        skill = db.query(Skill).filter(Skill.id == session_data.skill_id).first()
        if not skill:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Skill not found",
            )
        query = query.filter(Question.skill_id == session_data.skill_id)

    if session_data.difficulty:
        query = query.filter(Question.difficulty == session_data.difficulty)

    # Select random questions
    questions = query.order_by(func.random()).limit(session_data.question_count).all()

    if len(questions) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions match the specified filters",
        )

    # Create session
    session = TestSession(
        student_id=current_user.id,
        test_type=TestType.PRACTICE,
        status=TestStatus.NOT_STARTED,
        subject_area=session_data.subject,
        total_questions=len(questions),
        time_limit_minutes=session_data.time_limit_minutes,
        question_config={
            "domain_id": session_data.domain_id,
            "skill_id": session_data.skill_id,
            "difficulty": session_data.difficulty.value if session_data.difficulty else None,
        },
    )
    db.add(session)
    db.flush()

    # Create TestQuestion links
    for order, question in enumerate(questions, start=1):
        test_question = TestQuestion(
            test_session_id=session.id,
            question_id=question.id,
            question_order=order,
        )
        db.add(test_question)

    db.commit()
    db.refresh(session)

    return PracticeSessionBrief(
        id=session.id,
        status=session.status,
        test_type=session.test_type,
        subject_area=session.subject_area,
        total_questions=session.total_questions,
        questions_answered=session.questions_answered,
        questions_correct=session.questions_correct,
        score_percentage=session.score_percentage,
        time_limit_minutes=session.time_limit_minutes,
        time_spent_seconds=session.time_spent_seconds,
        created_at=session.created_at,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )


@router.get("", response_model=PracticeSessionListResponse)
def list_practice_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    session_status: Optional[TestStatus] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PracticeSessionListResponse:
    """
    List the current user's practice sessions.

    Optionally filter by status. Results are paginated and ordered
    by creation date (newest first).
    """
    query = db.query(TestSession).filter(
        TestSession.student_id == current_user.id,
        TestSession.test_type == TestType.PRACTICE,
    )

    if session_status:
        query = query.filter(TestSession.status == session_status)

    total = query.count()
    sessions = query.order_by(TestSession.created_at.desc()).offset(offset).limit(limit).all()

    items = [
        PracticeSessionBrief(
            id=s.id,
            status=s.status,
            test_type=s.test_type,
            subject_area=s.subject_area,
            total_questions=s.total_questions,
            questions_answered=s.questions_answered,
            questions_correct=s.questions_correct,
            score_percentage=s.score_percentage,
            time_limit_minutes=s.time_limit_minutes,
            time_spent_seconds=s.time_spent_seconds,
            created_at=s.created_at,
            started_at=s.started_at,
            completed_at=s.completed_at,
        )
        for s in sessions
    ]

    return PracticeSessionListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{session_id}", response_model=PracticeSessionDetail)
def get_practice_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PracticeSessionDetail:
    """
    Get a practice session by ID.

    For in-progress sessions, includes the current question.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    current_question = None
    if session.status == TestStatus.IN_PROGRESS:
        # Get the current question
        test_question = db.query(TestQuestion).filter(
            TestQuestion.test_session_id == session.id,
            TestQuestion.question_order == session.current_question_index + 1,
        ).first()

        if test_question:
            question = test_question.question

            # Build domain/skill brief
            domain_brief = None
            skill_brief = None

            if question.domain_id:
                domain = db.query(Domain).filter(Domain.id == question.domain_id).first()
                if domain:
                    domain_brief = DomainBrief(id=domain.id, code=domain.code, name=domain.name)

            if question.skill_id:
                skill = db.query(Skill).filter(Skill.id == question.skill_id).first()
                if skill:
                    skill_brief = SkillBrief(id=skill.id, code=skill.code, name=skill.name)

            # Build choices list
            choices = None
            if question.choices_json:
                choices = [
                    ChoiceOption(index=i, content=c)
                    for i, c in enumerate(question.choices_json)
                ]

            question_in_session = QuestionInSession(
                id=question.id,
                prompt_html=question.prompt_html,
                choices=choices,
                difficulty=question.difficulty,
                domain=domain_brief,
                skill=skill_brief,
            )

            current_question = CurrentQuestion(
                order=test_question.question_order,
                question=question_in_session,
                is_answered=test_question.is_answered,
                is_flagged=test_question.is_flagged,
            )

    return PracticeSessionDetail(
        id=session.id,
        status=session.status,
        test_type=session.test_type,
        subject_area=session.subject_area,
        total_questions=session.total_questions,
        current_question_index=session.current_question_index,
        questions_answered=session.questions_answered,
        time_limit_minutes=session.time_limit_minutes,
        time_spent_seconds=session.time_spent_seconds,
        started_at=session.started_at,
        current_question=current_question,
    )


@router.post("/{session_id}/start", response_model=SessionStatusUpdate)
def start_practice_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionStatusUpdate:
    """
    Start a practice session.

    Changes status from NOT_STARTED to IN_PROGRESS and sets started_at.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    if session.status != TestStatus.NOT_STARTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start session with status '{session.status.value}'",
        )

    session.status = TestStatus.IN_PROGRESS
    session.started_at = datetime.now(timezone.utc)
    session.current_question_index = 0

    db.commit()
    db.refresh(session)

    return SessionStatusUpdate(
        id=session.id,
        status=session.status,
        current_question_index=session.current_question_index,
        time_spent_seconds=session.time_spent_seconds,
        started_at=session.started_at,
    )


@router.post("/{session_id}/answer", response_model=AnswerResult)
def submit_answer(
    session_id: UUID,
    answer_data: AnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnswerResult:
    """
    Submit an answer for the current question.

    Records the response, checks correctness, and advances to next question.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    if session.status != TestStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not in progress",
        )

    # Get current test question
    test_question = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id,
        TestQuestion.question_order == session.current_question_index + 1,
    ).first()

    if not test_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No current question found",
        )

    if test_question.is_answered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question already answered",
        )

    question = test_question.question
    is_correct = _check_answer(question, answer_data.answer)

    # Create student response
    response = StudentResponse(
        student_id=current_user.id,
        question_id=question.id,
        test_session_id=session.id,
        response_json=answer_data.answer,
        is_correct=is_correct,
        time_spent_seconds=answer_data.time_spent_seconds,
        submitted_at=datetime.now(timezone.utc),
        flagged_for_review=answer_data.flagged_for_review,
    )
    db.add(response)

    # Update test question
    test_question.is_answered = True
    test_question.is_flagged = answer_data.flagged_for_review

    # Update session counters
    session.questions_answered += 1
    if is_correct:
        session.questions_correct += 1

    # Track total time
    if session.time_spent_seconds is None:
        session.time_spent_seconds = answer_data.time_spent_seconds
    else:
        session.time_spent_seconds += answer_data.time_spent_seconds

    # Update skill ability for analytics tracking
    skill_id = question.skill_id
    if skill_id:
        # Get all responses for this skill (including the one we just added)
        responses = _get_skill_responses(db, current_user.id, skill_id)
        # Add the current response (not yet in DB)
        responses.append({
            "a": question.irt_discrimination_a or DEFAULT_A,
            "b": question.irt_difficulty_b or DEFAULT_B,
            "c": question.irt_guessing_c if question.irt_guessing_c is not None else DEFAULT_C_MCQ,
            "is_correct": is_correct,
        })
        # Update skill ability
        update_skill_ability(
            db, current_user.id, skill_id, responses,
            session_length=session.total_questions,
            session_correct=session.questions_correct,
            session_total=session.questions_answered
        )
        # Propagate to domain and section
        propagate_ability_updates(db, current_user.id, skill_id)

    # Determine next question
    next_question_index = None
    session_complete = False

    if session.current_question_index + 1 < session.total_questions:
        session.current_question_index += 1
        next_question_index = session.current_question_index
    else:
        session_complete = True

    db.commit()

    return AnswerResult(
        is_correct=is_correct,
        correct_answer=question.correct_answer_json,
        explanation_html=question.explanation_html,
        next_question_index=next_question_index,
        session_complete=session_complete,
    )


@router.post("/{session_id}/pause", response_model=SessionStatusUpdate)
def pause_practice_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionStatusUpdate:
    """
    Pause a practice session.

    Only in-progress sessions can be paused.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    if session.status != TestStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only in-progress sessions can be paused",
        )

    session.status = TestStatus.PAUSED

    db.commit()
    db.refresh(session)

    return SessionStatusUpdate(
        id=session.id,
        status=session.status,
        current_question_index=session.current_question_index,
        time_spent_seconds=session.time_spent_seconds,
        started_at=session.started_at,
    )


@router.post("/{session_id}/resume", response_model=SessionStatusUpdate)
def resume_practice_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionStatusUpdate:
    """
    Resume a paused practice session.

    Only paused sessions can be resumed.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    if session.status != TestStatus.PAUSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only paused sessions can be resumed",
        )

    session.status = TestStatus.IN_PROGRESS

    db.commit()
    db.refresh(session)

    return SessionStatusUpdate(
        id=session.id,
        status=session.status,
        current_question_index=session.current_question_index,
        time_spent_seconds=session.time_spent_seconds,
        started_at=session.started_at,
    )


@router.post("/{session_id}/complete", response_model=SessionComplete)
def complete_practice_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionComplete:
    """
    Complete a practice session.

    Calculates final score and marks the session as completed.
    Can be called to submit early or after answering all questions.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    if session.status not in (TestStatus.IN_PROGRESS, TestStatus.PAUSED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session cannot be completed",
        )

    # Calculate score
    if session.questions_answered > 0:
        score_percentage = (session.questions_correct / session.questions_answered) * 100
    else:
        score_percentage = 0.0

    session.status = TestStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    session.score_percentage = score_percentage

    db.commit()
    db.refresh(session)

    return SessionComplete(
        id=session.id,
        status=session.status,
        score_percentage=session.score_percentage,
        questions_correct=session.questions_correct,
        total_questions=session.total_questions,
        time_spent_seconds=session.time_spent_seconds or 0,
    )


@router.get("/{session_id}/results", response_model=SessionResults)
def get_session_results(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResults:
    """
    Get detailed results for a completed session.

    Returns all questions with answers, correctness, and skill breakdown.
    """
    session = _get_session_or_404(session_id, current_user.id, db)

    if session.status != TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Results are only available for completed sessions",
        )

    # Get all test questions with responses
    test_questions = db.query(TestQuestion).filter(
        TestQuestion.test_session_id == session.id,
    ).order_by(TestQuestion.question_order).all()

    # Get all responses for this session
    responses = {
        r.question_id: r
        for r in db.query(StudentResponse).filter(
            StudentResponse.test_session_id == session.id,
        ).all()
    }

    # Build results
    question_results = []
    skill_stats = {}  # skill_id -> {name, correct, total}

    for tq in test_questions:
        question = tq.question
        response = responses.get(question.id)

        # Build choices
        choices = None
        if question.choices_json:
            choices = [
                ChoiceOption(index=i, content=c)
                for i, c in enumerate(question.choices_json)
            ]

        # Get skill info
        skill_brief = None
        if question.skill_id:
            skill = db.query(Skill).filter(Skill.id == question.skill_id).first()
            if skill:
                skill_brief = SkillBrief(id=skill.id, code=skill.code, name=skill.name)

                # Track skill stats
                if skill.id not in skill_stats:
                    skill_stats[skill.id] = {"name": skill.name, "correct": 0, "total": 0}
                skill_stats[skill.id]["total"] += 1
                if response and response.is_correct:
                    skill_stats[skill.id]["correct"] += 1

        question_results.append(QuestionResult(
            order=tq.question_order,
            question_id=question.id,
            prompt_html=question.prompt_html,
            choices=choices,
            your_answer=response.response_json if response else None,
            correct_answer=question.correct_answer_json,
            is_correct=response.is_correct if response else False,
            explanation_html=question.explanation_html,
            time_spent_seconds=response.time_spent_seconds if response else None,
            skill=skill_brief,
        ))

    # Build skill breakdown
    skill_breakdown = [
        SkillBreakdown(
            skill_id=skill_id,
            skill_name=stats["name"],
            correct=stats["correct"],
            total=stats["total"],
            percentage=(stats["correct"] / stats["total"] * 100) if stats["total"] > 0 else 0,
        )
        for skill_id, stats in skill_stats.items()
    ]

    return SessionResults(
        id=session.id,
        status=session.status,
        score_percentage=session.score_percentage or 0.0,
        questions_correct=session.questions_correct,
        total_questions=session.total_questions,
        time_spent_seconds=session.time_spent_seconds or 0,
        started_at=session.started_at,
        completed_at=session.completed_at,
        questions=question_results,
        skill_breakdown=skill_breakdown,
    )
