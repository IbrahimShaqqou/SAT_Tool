"""
SAT Tutoring Platform - Adaptive Testing API

Endpoints for IRT-based adaptive testing and ability tracking.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.question import Question
from app.models.taxonomy import Skill
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse, StudentSkill
from app.models.enums import TestType, TestStatus, AnswerType
from app.schemas.adaptive import (
    AbilityEstimate,
    SkillAbility,
    AbilityProfile,
    AdaptiveSessionCreate,
    AdaptiveQuestionInfo,
    AdaptiveSessionDetail,
    AdaptiveAnswerSubmit,
    AdaptiveAnswerResult,
    AdaptiveSessionComplete,
    NextQuestionRequest,
    NextQuestionResponse,
    CalibrationStats,
    CalibrationResult,
)
from app.schemas.question import ChoiceOption, DomainBrief, SkillBrief
from app.services.irt_service import (
    probability_correct,
    item_information,
    estimate_ability_eap,
    select_adaptive_question,
    get_skill_ability,
    update_skill_ability,
    calculate_overall_ability,
    PRIOR_MEAN,
    PRIOR_SD,
    DEFAULT_A,
    DEFAULT_B,
    DEFAULT_C_MCQ,
)
from app.services.irt_calibration import (
    initialize_parameters_sql,
    get_calibration_stats as get_calibration_stats_service,
)

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================

def _make_ability_estimate(theta: float, se: float, count: int = 0) -> AbilityEstimate:
    """Create AbilityEstimate from theta and SE."""
    return AbilityEstimate(
        theta=round(theta, 3),
        standard_error=round(se, 3),
        confidence_low=round(theta - 1.96 * se, 3),
        confidence_high=round(theta + 1.96 * se, 3),
        response_count=count,
    )


def _get_question_responses_for_skill(
    db: Session,
    student_id: UUID,
    skill_id: int
) -> list:
    """Get all responses for a student-skill pair with IRT parameters."""
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


def _build_question_info(
    question: Question,
    db: Session,
    theta: Optional[float] = None
) -> AdaptiveQuestionInfo:
    """Build AdaptiveQuestionInfo from a Question."""
    # Get skill and domain info
    skill_brief = None
    domain_brief = None

    if question.skill_id:
        skill = db.query(Skill).filter(Skill.id == question.skill_id).first()
        if skill:
            skill_brief = SkillBrief(id=skill.id, code=skill.code, name=skill.name)

    if question.domain:
        domain_brief = DomainBrief(
            id=question.domain.id,
            code=question.domain.code,
            name=question.domain.name
        )

    # Build choices
    choices = None
    if question.choices_json:
        choices = [
            ChoiceOption(index=i, content=c)
            for i, c in enumerate(question.choices_json)
        ]

    # Calculate expected probability if theta provided
    expected_prob = None
    if theta is not None:
        a = question.irt_discrimination_a or DEFAULT_A
        b = question.irt_difficulty_b or DEFAULT_B
        c = question.irt_guessing_c if question.irt_guessing_c is not None else DEFAULT_C_MCQ
        expected_prob = round(probability_correct(theta, a, b, c), 3)

    # Get passage from raw_import_json if available
    passage_html = None
    if question.raw_import_json:
        passage_html = question.raw_import_json.get("stimulus_html")

    return AdaptiveQuestionInfo(
        id=question.id,
        prompt_html=question.prompt_html,
        passage_html=passage_html,
        choices=choices,
        skill=skill_brief,
        domain=domain_brief,
        difficulty_b=question.irt_difficulty_b,
        expected_probability=expected_prob,
    )


def _check_answer(question: Question, submitted_answer: dict) -> bool:
    """Check if submitted answer is correct."""
    correct = question.correct_answer_json

    if "index" in submitted_answer and "index" in correct:
        return submitted_answer["index"] == correct["index"]

    if "answer" in submitted_answer and "answers" in correct:
        user_answer = str(submitted_answer["answer"]).strip().lower()
        correct_answers = [str(a).strip().lower() for a in correct["answers"]]
        return user_answer in correct_answers

    return False


# =============================================================================
# Ability Profile Endpoints
# =============================================================================

@router.get("/ability-profile", response_model=AbilityProfile)
def get_ability_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AbilityProfile:
    """
    Get the current user's complete ability profile.

    Returns overall ability and per-skill ability estimates based on
    all historical responses.
    """
    # Get overall ability
    overall_theta, overall_se = calculate_overall_ability(db, current_user.id)

    # Get total response count
    total_responses = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == current_user.id
    ).scalar() or 0

    # Get all skill abilities
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == current_user.id
    ).all()

    skill_abilities = []
    for record in skill_records:
        skill = db.query(Skill).filter(Skill.id == record.skill_id).first()
        if skill:
            skill_abilities.append(SkillAbility(
                skill_id=skill.id,
                skill_name=skill.name,
                skill_code=skill.code,
                ability=_make_ability_estimate(
                    record.ability_theta or PRIOR_MEAN,
                    record.ability_se or PRIOR_SD,
                    record.responses_for_estimate or 0
                ),
                mastery_level=record.mastery_level or 0.0,
                last_practiced=record.last_practiced_at,
            ))

    return AbilityProfile(
        student_id=current_user.id,
        overall_ability=_make_ability_estimate(overall_theta, overall_se, total_responses),
        skill_abilities=skill_abilities,
        total_responses=total_responses,
        last_updated=datetime.now(timezone.utc),
    )


@router.get("/skill-ability/{skill_id}", response_model=SkillAbility)
def get_skill_ability_endpoint(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SkillAbility:
    """Get ability estimate for a specific skill."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )

    theta, se, count = get_skill_ability(db, current_user.id, skill_id)

    # Get StudentSkill record for mastery and last practiced
    skill_record = db.query(StudentSkill).filter(
        StudentSkill.student_id == current_user.id,
        StudentSkill.skill_id == skill_id
    ).first()

    mastery = skill_record.mastery_level if skill_record else 0.0
    last_practiced = skill_record.last_practiced_at if skill_record else None

    return SkillAbility(
        skill_id=skill.id,
        skill_name=skill.name,
        skill_code=skill.code,
        ability=_make_ability_estimate(theta, se, count),
        mastery_level=mastery,
        last_practiced=last_practiced,
    )


# =============================================================================
# Next Question Selection
# =============================================================================

@router.post("/next-question", response_model=NextQuestionResponse)
def get_next_adaptive_question(
    request: NextQuestionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NextQuestionResponse:
    """
    Get the next best question for adaptive practice.

    Selects the question that provides maximum information at the
    student's current ability level for the specified skill.
    """
    # Get current ability for the skill (or overall if no skill specified)
    if request.skill_id:
        theta, se, _ = get_skill_ability(db, current_user.id, request.skill_id)
        skill_filter = [request.skill_id]
    else:
        theta, se = calculate_overall_ability(db, current_user.id)
        skill_filter = None

    # Build question pool
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
    )

    if skill_filter:
        query = query.filter(Question.skill_id.in_(skill_filter))

    # Exclude already answered questions
    exclude_ids = set(request.exclude_ids)
    if exclude_ids:
        query = query.filter(~Question.id.in_(exclude_ids))

    available_questions = query.all()

    if not available_questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No available questions for the specified criteria",
        )

    # Select best question
    selected = select_adaptive_question(theta, available_questions)

    if not selected:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not select a question",
        )

    # Calculate information for this question
    a = selected.irt_discrimination_a or DEFAULT_A
    b = selected.irt_difficulty_b or DEFAULT_B
    c = selected.irt_guessing_c if selected.irt_guessing_c is not None else DEFAULT_C_MCQ
    info = item_information(theta, a, b, c)

    return NextQuestionResponse(
        question=_build_question_info(selected, db, theta),
        current_ability=_make_ability_estimate(theta, se),
        expected_information=round(info, 4),
    )


# =============================================================================
# Adaptive Sessions
# =============================================================================

@router.post("/sessions", response_model=AdaptiveSessionDetail, status_code=status.HTTP_201_CREATED)
def create_adaptive_session(
    session_data: AdaptiveSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdaptiveSessionDetail:
    """
    Create a new adaptive practice session.

    Questions will be selected adaptively as the student progresses,
    targeting their current ability level.
    """
    # Validate skills exist
    skills = db.query(Skill).filter(Skill.id.in_(session_data.skill_ids)).all()
    if len(skills) != len(session_data.skill_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more skills not found",
        )

    # Get current ability (average across requested skills)
    abilities = []
    for skill_id in session_data.skill_ids:
        theta, se, _ = get_skill_ability(db, current_user.id, skill_id)
        abilities.append(theta)

    current_theta = sum(abilities) / len(abilities) if abilities else PRIOR_MEAN

    # Create session
    session = TestSession(
        student_id=current_user.id,
        test_type=TestType.ADAPTIVE,
        status=TestStatus.NOT_STARTED,
        total_questions=session_data.question_count,
        time_limit_minutes=session_data.time_limit_minutes,
        question_config={
            "skill_ids": session_data.skill_ids,
            "adaptive": True,
            "initial_theta": current_theta,
        },
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return AdaptiveSessionDetail(
        id=session.id,
        status=session.status.value,
        skill_ids=session_data.skill_ids,
        total_questions=session.total_questions,
        questions_answered=0,
        current_ability=_make_ability_estimate(current_theta, PRIOR_SD),
        time_limit_minutes=session.time_limit_minutes,
        time_spent_seconds=0,
        started_at=None,
        current_question=None,
    )


@router.post("/sessions/{session_id}/start", response_model=AdaptiveSessionDetail)
def start_adaptive_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdaptiveSessionDetail:
    """
    Start an adaptive session and get the first question.

    The first question is selected based on the student's current
    ability estimate for the session's skills.
    """
    session = db.query(TestSession).filter(
        TestSession.id == session_id,
        TestSession.student_id == current_user.id,
        TestSession.test_type == TestType.ADAPTIVE,
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptive session not found",
        )

    if session.status != TestStatus.NOT_STARTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start session with status '{session.status.value}'",
        )

    # Get skill IDs from config
    skill_ids = session.question_config.get("skill_ids", [])
    initial_theta = session.question_config.get("initial_theta", PRIOR_MEAN)

    # Get available questions for these skills
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
        Question.skill_id.in_(skill_ids),
    )

    available_questions = query.all()

    if not available_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions available for the selected skills",
        )

    # Select first question
    first_question = select_adaptive_question(initial_theta, available_questions)

    if not first_question:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to select first question",
        )

    # Create TestQuestion record
    test_question = TestQuestion(
        test_session_id=session.id,
        question_id=first_question.id,
        question_order=1,
    )
    db.add(test_question)

    # Update session
    session.status = TestStatus.IN_PROGRESS
    session.started_at = datetime.now(timezone.utc)
    session.current_question_index = 0

    db.commit()
    db.refresh(session)

    return AdaptiveSessionDetail(
        id=session.id,
        status=session.status.value,
        skill_ids=skill_ids,
        total_questions=session.total_questions,
        questions_answered=session.questions_answered,
        current_ability=_make_ability_estimate(initial_theta, PRIOR_SD),
        time_limit_minutes=session.time_limit_minutes,
        time_spent_seconds=session.time_spent_seconds or 0,
        started_at=session.started_at,
        current_question=_build_question_info(first_question, db, initial_theta),
    )


@router.post("/sessions/{session_id}/answer", response_model=AdaptiveAnswerResult)
def submit_adaptive_answer(
    session_id: UUID,
    answer_data: AdaptiveAnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdaptiveAnswerResult:
    """
    Submit an answer in an adaptive session.

    Updates the student's ability estimate and selects the next
    question based on the new ability level.
    """
    session = db.query(TestSession).filter(
        TestSession.id == session_id,
        TestSession.student_id == current_user.id,
        TestSession.test_type == TestType.ADAPTIVE,
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptive session not found",
        )

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

    if not test_question or test_question.is_answered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No current question or already answered",
        )

    question = test_question.question
    skill_id = question.skill_id
    skill_ids = session.question_config.get("skill_ids", [])

    # Get ability BEFORE answering
    if skill_id:
        theta_before, se_before, count_before = get_skill_ability(db, current_user.id, skill_id)
    else:
        theta_before, se_before = calculate_overall_ability(db, current_user.id)
        count_before = 0

    ability_before = _make_ability_estimate(theta_before, se_before, count_before)

    # Check answer
    is_correct = _check_answer(question, answer_data.answer)

    # Create response record
    response = StudentResponse(
        student_id=current_user.id,
        question_id=question.id,
        test_session_id=session.id,
        response_json=answer_data.answer,
        is_correct=is_correct,
        time_spent_seconds=answer_data.time_spent_seconds,
        submitted_at=datetime.now(timezone.utc),
        ability_estimate_before=theta_before,
    )
    db.add(response)

    # Update test question
    test_question.is_answered = True

    # Update session counters
    session.questions_answered += 1
    if is_correct:
        session.questions_correct += 1

    if session.time_spent_seconds is None:
        session.time_spent_seconds = answer_data.time_spent_seconds
    else:
        session.time_spent_seconds += answer_data.time_spent_seconds

    # Update ability for this skill
    if skill_id:
        responses = _get_question_responses_for_skill(db, current_user.id, skill_id)
        # Add the current response
        responses.append({
            "a": question.irt_discrimination_a or DEFAULT_A,
            "b": question.irt_difficulty_b or DEFAULT_B,
            "c": question.irt_guessing_c if question.irt_guessing_c is not None else DEFAULT_C_MCQ,
            "is_correct": is_correct,
        })
        theta_after, se_after = update_skill_ability(db, current_user.id, skill_id, responses)
    else:
        theta_after, se_after = calculate_overall_ability(db, current_user.id)

    # Update response with ability after
    response.ability_estimate_after = theta_after

    ability_after = _make_ability_estimate(
        theta_after, se_after, count_before + 1
    )

    # Determine if session is complete
    session_complete = session.questions_answered >= session.total_questions
    next_question_info = None
    questions_remaining = session.total_questions - session.questions_answered

    if not session_complete:
        # Get already answered question IDs
        answered_ids = {
            tq.question_id for tq in
            db.query(TestQuestion).filter(
                TestQuestion.test_session_id == session.id
            ).all()
        }

        # Get available questions
        query = db.query(Question).filter(
            Question.is_active == True,
            Question.deleted_at == None,
            Question.skill_id.in_(skill_ids),
            ~Question.id.in_(answered_ids),
        )
        available = query.all()

        if available:
            # Select next question based on updated ability
            next_question = select_adaptive_question(theta_after, available)

            if next_question:
                # Create new TestQuestion
                new_tq = TestQuestion(
                    test_session_id=session.id,
                    question_id=next_question.id,
                    question_order=session.questions_answered + 1,
                )
                db.add(new_tq)

                session.current_question_index = session.questions_answered

                next_question_info = _build_question_info(next_question, db, theta_after)
        else:
            # No more questions available
            session_complete = True

    if session_complete:
        session.status = TestStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        if session.questions_answered > 0:
            session.score_percentage = (session.questions_correct / session.questions_answered) * 100

    db.commit()

    return AdaptiveAnswerResult(
        is_correct=is_correct,
        correct_answer=question.correct_answer_json,
        explanation_html=question.explanation_html,
        ability_before=ability_before,
        ability_after=ability_after,
        ability_change=round(theta_after - theta_before, 3),
        next_question=next_question_info,
        session_complete=session_complete,
        questions_remaining=questions_remaining,
    )


@router.get("/sessions/{session_id}", response_model=AdaptiveSessionDetail)
def get_adaptive_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdaptiveSessionDetail:
    """Get an adaptive session by ID."""
    session = db.query(TestSession).filter(
        TestSession.id == session_id,
        TestSession.student_id == current_user.id,
        TestSession.test_type == TestType.ADAPTIVE,
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptive session not found",
        )

    skill_ids = session.question_config.get("skill_ids", [])

    # Get current ability
    if skill_ids:
        abilities = [get_skill_ability(db, current_user.id, sid)[0] for sid in skill_ids]
        current_theta = sum(abilities) / len(abilities)
    else:
        current_theta, _ = calculate_overall_ability(db, current_user.id)

    # Get current question if in progress
    current_question = None
    if session.status == TestStatus.IN_PROGRESS:
        test_question = db.query(TestQuestion).filter(
            TestQuestion.test_session_id == session.id,
            TestQuestion.question_order == session.current_question_index + 1,
            TestQuestion.is_answered == False,
        ).first()

        if test_question:
            current_question = _build_question_info(
                test_question.question, db, current_theta
            )

    return AdaptiveSessionDetail(
        id=session.id,
        status=session.status.value,
        skill_ids=skill_ids,
        total_questions=session.total_questions,
        questions_answered=session.questions_answered,
        current_ability=_make_ability_estimate(current_theta, PRIOR_SD),
        time_limit_minutes=session.time_limit_minutes,
        time_spent_seconds=session.time_spent_seconds or 0,
        started_at=session.started_at,
        current_question=current_question,
    )


@router.post("/sessions/{session_id}/complete", response_model=AdaptiveSessionComplete)
def complete_adaptive_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdaptiveSessionComplete:
    """Complete an adaptive session and get final results."""
    session = db.query(TestSession).filter(
        TestSession.id == session_id,
        TestSession.student_id == current_user.id,
        TestSession.test_type == TestType.ADAPTIVE,
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptive session not found",
        )

    if session.status not in (TestStatus.IN_PROGRESS, TestStatus.PAUSED):
        if session.status == TestStatus.COMPLETED:
            # Already completed, just return results
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session cannot be completed",
            )

    skill_ids = session.question_config.get("skill_ids", [])
    initial_theta = session.question_config.get("initial_theta", PRIOR_MEAN)

    if session.status != TestStatus.COMPLETED:
        # Calculate final score
        if session.questions_answered > 0:
            session.score_percentage = (session.questions_correct / session.questions_answered) * 100
        else:
            session.score_percentage = 0.0

        session.status = TestStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        db.commit()

    # Get current abilities for skills
    skill_progress = []
    abilities = []
    for skill_id in skill_ids:
        theta, se, count = get_skill_ability(db, current_user.id, skill_id)
        abilities.append(theta)

        skill = db.query(Skill).filter(Skill.id == skill_id).first()
        if skill:
            skill_record = db.query(StudentSkill).filter(
                StudentSkill.student_id == current_user.id,
                StudentSkill.skill_id == skill_id
            ).first()

            skill_progress.append(SkillAbility(
                skill_id=skill.id,
                skill_name=skill.name,
                skill_code=skill.code,
                ability=_make_ability_estimate(theta, se, count),
                mastery_level=skill_record.mastery_level if skill_record else 0.0,
                last_practiced=skill_record.last_practiced_at if skill_record else None,
            ))

    final_theta = sum(abilities) / len(abilities) if abilities else PRIOR_MEAN
    ability_growth = final_theta - initial_theta

    return AdaptiveSessionComplete(
        id=session.id,
        score_percentage=session.score_percentage or 0.0,
        questions_correct=session.questions_correct or 0,
        total_questions=session.questions_answered,
        time_spent_seconds=session.time_spent_seconds or 0,
        ability_start=_make_ability_estimate(initial_theta, PRIOR_SD),
        ability_end=_make_ability_estimate(final_theta, PRIOR_SD),
        ability_growth=round(ability_growth, 3),
        skill_progress=skill_progress,
    )


# =============================================================================
# IRT Calibration Endpoints (Admin/Tutor only)
# =============================================================================

@router.get("/calibration/stats", response_model=CalibrationStats)
def get_calibration_stats_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalibrationStats:
    """Get statistics about IRT parameter calibration coverage."""
    # TODO: Add role check for tutor/admin
    stats = get_calibration_stats_service(db)

    return CalibrationStats(
        total_questions=stats["total_questions"],
        coverage=stats["coverage"],
        percentages=stats["percentages"],
        parameter_ranges=stats["parameter_ranges"],
    )


@router.post("/calibration/initialize", response_model=CalibrationResult)
def run_calibration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalibrationResult:
    """
    Initialize IRT parameters for all questions.

    Uses score_band_range for difficulty (b) and difficulty level for
    discrimination (a). This should be run once to set up initial values.
    """
    # TODO: Add role check for admin only
    try:
        results = initialize_parameters_sql(db)
        return CalibrationResult(
            success=True,
            message="IRT parameters initialized successfully",
            stats=results,
        )
    except Exception as e:
        db.rollback()
        return CalibrationResult(
            success=False,
            message=f"Calibration failed: {str(e)}",
            stats={},
        )
