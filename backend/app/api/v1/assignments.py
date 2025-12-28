"""
SAT Tutoring Platform - Assignments API

Endpoints for tutor-assigned practice sessions.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_tutor
from app.models.user import User
from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.assignment import Assignment, AssignmentQuestion
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse, StudentSkill
from app.models.enums import (
    AssignmentStatus, TestType, TestStatus, UserRole, SubjectArea, AnswerType
)
from app.services.irt_service import (
    select_adaptive_question,
    get_skill_ability,
    update_skill_ability,
    PRIOR_MEAN,
    DEFAULT_A,
    DEFAULT_B,
    DEFAULT_C_MCQ,
)
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentBrief,
    AssignmentListResponse,
    AssignmentDetail,
    CurrentAssignmentQuestion,
    AssignmentAnswerSubmit,
    AssignmentAnswerResult,
    AssignmentStatusUpdate,
    AssignmentComplete,
    AssignmentQuestionItem,
    AssignmentQuestionsResponse,
)

router = APIRouter()


def _get_assignment_or_404(
    assignment_id: UUID,
    db: Session,
    user: User,
    require_tutor: bool = False,
    require_student: bool = False,
) -> Assignment:
    """Get an assignment by ID with role-based access check."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    # Check access based on role
    if require_tutor and assignment.tutor_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the tutor who created this assignment can access it",
        )

    if require_student and assignment.student_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned student can access this assignment",
        )

    # General access: tutor or student
    if assignment.tutor_id != user.id and assignment.student_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return assignment


def _get_student_name(user: User) -> str:
    """Get full name for a user."""
    return f"{user.first_name} {user.last_name}"


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


def _get_student_ability_for_assignment(
    db: Session,
    student_id: UUID,
    assignment: Assignment,
) -> float:
    """
    Get student's current ability estimate for the assignment's skill(s).
    Uses average theta across all relevant skills, or prior mean if no history.
    """
    skill_ids = assignment.question_config.get("skill_ids") or []
    if assignment.question_config.get("skill_id"):
        skill_ids = [assignment.question_config["skill_id"]]

    if not skill_ids:
        # No specific skills - use overall ability from recent responses
        return PRIOR_MEAN

    # Get ability estimates for each skill
    thetas = []
    for skill_id in skill_ids:
        theta, se, count = get_skill_ability(db, student_id, skill_id)
        if count > 0:  # Has responses for this skill
            thetas.append(theta)

    if thetas:
        return sum(thetas) / len(thetas)
    return PRIOR_MEAN


def _update_ability_after_response(
    db: Session,
    student_id: UUID,
    skill_id: int,
    question: Question,
    is_correct: bool,
) -> None:
    """
    Update student's ability estimate for a skill after a response.
    Uses the IRT service to recalculate theta.
    """
    # Get all responses for this student-skill pair
    responses = db.query(StudentResponse).join(
        Question, StudentResponse.question_id == Question.id
    ).filter(
        StudentResponse.student_id == student_id,
        Question.skill_id == skill_id,
    ).all()

    # Build response data for IRT estimation
    response_data = []
    for r in responses:
        q = r.question
        response_data.append({
            "a": q.irt_discrimination_a or DEFAULT_A,
            "b": q.irt_difficulty_b or DEFAULT_B,
            "c": q.irt_guessing_c if q.irt_guessing_c is not None else (
                DEFAULT_C_MCQ if q.answer_type == AnswerType.MCQ else 0.0
            ),
            "is_correct": r.is_correct,
        })

    # Add the current response
    response_data.append({
        "a": question.irt_discrimination_a or DEFAULT_A,
        "b": question.irt_difficulty_b or DEFAULT_B,
        "c": question.irt_guessing_c if question.irt_guessing_c is not None else (
            DEFAULT_C_MCQ if question.answer_type == AnswerType.MCQ else 0.0
        ),
        "is_correct": is_correct,
    })

    # Update skill ability with all responses (calculates theta internally)
    update_skill_ability(db, student_id, skill_id, response_data)


def _select_adaptive_question_for_assignment(
    db: Session,
    student_id: UUID,
    assignment: Assignment,
    excluded_ids: list,
) -> Optional[Question]:
    """
    Select the next question for an adaptive assignment using IRT.
    Maximizes information at the student's current ability level.
    """
    from typing import List

    # Get student's current ability
    theta = _get_student_ability_for_assignment(db, student_id, assignment)

    # Build query for candidate questions
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
    )

    # Apply assignment filters
    config = assignment.question_config or {}

    if config.get("subject"):
        query = query.filter(Question.subject_area == config["subject"])

    if config.get("domain_id"):
        query = query.filter(Question.domain_id == config["domain_id"])

    skill_ids = config.get("skill_ids") or []
    if config.get("skill_id") and not skill_ids:
        skill_ids = [config["skill_id"]]
    if skill_ids:
        query = query.filter(Question.skill_id.in_(skill_ids))

    if config.get("difficulty"):
        query = query.filter(Question.difficulty == config["difficulty"])

    # Exclude already-used questions
    if excluded_ids:
        query = query.filter(~Question.id.in_(excluded_ids))

    candidates = query.all()
    if not candidates:
        return None

    # Use IRT to select the best question
    return select_adaptive_question(theta, candidates)


@router.post("", response_model=AssignmentBrief, status_code=status.HTTP_201_CREATED)
def create_assignment(
    assignment_data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> AssignmentBrief:
    """
    Create a new assignment (tutor only).

    Selects questions based on filters and assigns to student.
    """
    # Verify student exists and is a student
    student = db.query(User).filter(
        User.id == assignment_data.student_id,
        User.role == UserRole.STUDENT,
        User.is_active == True,
    ).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student not found",
        )

    # Build query for question selection
    query = db.query(Question).filter(
        Question.is_active == True,
        Question.deleted_at == None,
        Question.subject_area == assignment_data.subject,
    )

    if assignment_data.domain_id:
        domain = db.query(Domain).filter(Domain.id == assignment_data.domain_id).first()
        if not domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Domain not found",
            )
        query = query.filter(Question.domain_id == assignment_data.domain_id)

    # For adaptive with multiple skills, use skill_ids; otherwise use skill_id
    skill_ids_to_use = assignment_data.skill_ids if assignment_data.skill_ids else (
        [assignment_data.skill_id] if assignment_data.skill_id else None
    )

    if skill_ids_to_use:
        # Validate skills exist
        skills = db.query(Skill).filter(Skill.id.in_(skill_ids_to_use)).all()
        if len(skills) != len(skill_ids_to_use):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more skills not found",
            )
        query = query.filter(Question.skill_id.in_(skill_ids_to_use))

    if assignment_data.difficulty:
        query = query.filter(Question.difficulty == assignment_data.difficulty)

    # For adaptive assignments: verify enough questions exist but don't pre-select
    # Questions will be selected dynamically using IRT when assignment starts
    if assignment_data.is_adaptive:
        available_count = query.count()
        if available_count < assignment_data.question_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough questions available. Found {available_count}, need {assignment_data.question_count}",
            )
        questions = []  # No pre-selected questions for adaptive
    else:
        # For regular assignments: select random questions upfront
        questions = query.order_by(func.random()).limit(assignment_data.question_count).all()

        if len(questions) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No questions match the specified filters",
            )

    # Create assignment
    assignment = Assignment(
        tutor_id=current_user.id,
        student_id=assignment_data.student_id,
        title=assignment_data.title,
        instructions=assignment_data.instructions,
        status=AssignmentStatus.PENDING,
        due_date=assignment_data.due_date,
        assigned_at=datetime.now(timezone.utc),
        question_count=assignment_data.question_count,  # Use requested count for adaptive
        time_limit_minutes=assignment_data.time_limit_minutes,
        target_score=assignment_data.target_score,
        is_adaptive=assignment_data.is_adaptive,
        question_config={
            "subject": assignment_data.subject.value,
            "domain_id": assignment_data.domain_id,
            "skill_id": assignment_data.skill_id,
            "skill_ids": skill_ids_to_use,
            "difficulty": assignment_data.difficulty.value if assignment_data.difficulty else None,
        },
    )
    db.add(assignment)
    db.flush()

    # Create AssignmentQuestion links (only for non-adaptive)
    for order, question in enumerate(questions, start=1):
        aq = AssignmentQuestion(
            assignment_id=assignment.id,
            question_id=question.id,
            question_order=order,
        )
        db.add(aq)

    db.commit()
    db.refresh(assignment)

    return AssignmentBrief(
        id=assignment.id,
        title=assignment.title,
        status=assignment.status,
        student_id=assignment.student_id,
        student_name=_get_student_name(student),
        tutor_id=assignment.tutor_id,
        tutor_name=_get_student_name(current_user),
        total_questions=assignment.question_count,
        questions_answered=0,
        score_percentage=None,
        due_date=assignment.due_date,
        created_at=assignment.created_at,
        is_adaptive=assignment.is_adaptive,
    )


@router.get("", response_model=AssignmentListResponse)
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    assignment_status: Optional[AssignmentStatus] = Query(None, alias="status"),
    student_id: Optional[UUID] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> AssignmentListResponse:
    """
    List assignments.

    - Students see their assigned assignments
    - Tutors see assignments they created (can filter by student_id)
    """
    query = db.query(Assignment)

    if current_user.role == UserRole.STUDENT:
        query = query.filter(Assignment.student_id == current_user.id)
    else:
        # Tutor sees their created assignments
        query = query.filter(Assignment.tutor_id == current_user.id)
        if student_id:
            query = query.filter(Assignment.student_id == student_id)

    if assignment_status:
        query = query.filter(Assignment.status == assignment_status)

    total = query.count()
    assignments = query.order_by(Assignment.created_at.desc()).offset(offset).limit(limit).all()

    # Get student/tutor names
    user_ids = set()
    for a in assignments:
        user_ids.add(a.student_id)
        user_ids.add(a.tutor_id)

    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    # Count answered questions per assignment
    assignment_ids = [a.id for a in assignments]
    answered_counts = {}
    if assignment_ids:
        # Count from test sessions linked to assignments
        session_stats = db.query(
            TestSession.assignment_id,
            TestSession.questions_answered,
            TestSession.score_percentage,
        ).filter(
            TestSession.assignment_id.in_(assignment_ids)
        ).all()

        for stat in session_stats:
            answered_counts[stat.assignment_id] = {
                "answered": stat.questions_answered or 0,
                "score": stat.score_percentage,
            }

    items = []
    for a in assignments:
        stats = answered_counts.get(a.id, {"answered": 0, "score": None})
        items.append(AssignmentBrief(
            id=a.id,
            title=a.title,
            status=a.status,
            student_id=a.student_id,
            student_name=_get_student_name(users.get(a.student_id)),
            tutor_id=a.tutor_id,
            tutor_name=_get_student_name(users.get(a.tutor_id)),
            total_questions=a.question_count or 0,
            questions_answered=stats["answered"],
            score_percentage=stats["score"] or a.actual_score,
            due_date=a.due_date,
            created_at=a.created_at,
            is_adaptive=a.is_adaptive,
        ))

    return AssignmentListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{assignment_id}", response_model=AssignmentDetail)
def get_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentDetail:
    """
    Get assignment details.

    For in-progress assignments, includes current question.
    """
    assignment = _get_assignment_or_404(assignment_id, db, current_user)

    student = db.query(User).filter(User.id == assignment.student_id).first()
    tutor = db.query(User).filter(User.id == assignment.tutor_id).first()

    # Get linked test session if exists
    session = db.query(TestSession).filter(
        TestSession.assignment_id == assignment.id
    ).first()

    current_question = None
    questions_answered = 0
    questions_correct = 0
    current_index = 0

    if session:
        questions_answered = session.questions_answered or 0
        questions_correct = session.questions_correct or 0
        current_index = session.current_question_index

        if assignment.status == AssignmentStatus.IN_PROGRESS:
            # Get current question
            aq = db.query(AssignmentQuestion).filter(
                AssignmentQuestion.assignment_id == assignment.id,
                AssignmentQuestion.question_order == current_index + 1,
            ).first()

            if aq:
                question = aq.question
                choices = None
                if question.choices_json:
                    choices = [
                        {"index": i, "content": c}
                        for i, c in enumerate(question.choices_json)
                    ]

                # Check if answered
                tq = db.query(TestQuestion).filter(
                    TestQuestion.test_session_id == session.id,
                    TestQuestion.question_id == question.id,
                ).first()

                current_question = CurrentAssignmentQuestion(
                    order=aq.question_order,
                    question_id=question.id,
                    prompt_html=question.prompt_html,
                    choices=choices,
                    is_answered=tq.is_answered if tq else False,
                )

    return AssignmentDetail(
        id=assignment.id,
        title=assignment.title,
        instructions=assignment.instructions,
        status=assignment.status,
        student_id=assignment.student_id,
        student_name=_get_student_name(student),
        tutor_id=assignment.tutor_id,
        tutor_name=_get_student_name(tutor),
        total_questions=assignment.question_count or 0,
        questions_answered=questions_answered,
        questions_correct=questions_correct,
        current_question_index=current_index,
        score_percentage=assignment.actual_score,
        due_date=assignment.due_date,
        time_limit_minutes=assignment.time_limit_minutes,
        target_score=assignment.target_score,
        tutor_feedback=assignment.tutor_feedback,
        started_at=assignment.started_at,
        completed_at=assignment.completed_at,
        created_at=assignment.created_at,
        current_question=current_question,
        is_adaptive=assignment.is_adaptive,
    )


@router.patch("/{assignment_id}", response_model=AssignmentBrief)
def update_assignment(
    assignment_id: UUID,
    update_data: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> AssignmentBrief:
    """
    Update an assignment (tutor only).

    Can update title, instructions, due date, and add feedback.
    """
    assignment = _get_assignment_or_404(
        assignment_id, db, current_user, require_tutor=True
    )

    if update_data.title is not None:
        assignment.title = update_data.title
    if update_data.instructions is not None:
        assignment.instructions = update_data.instructions
    if update_data.due_date is not None:
        assignment.due_date = update_data.due_date
    if update_data.tutor_feedback is not None:
        assignment.tutor_feedback = update_data.tutor_feedback

    db.commit()
    db.refresh(assignment)

    student = db.query(User).filter(User.id == assignment.student_id).first()
    tutor = db.query(User).filter(User.id == assignment.tutor_id).first()

    return AssignmentBrief(
        id=assignment.id,
        title=assignment.title,
        status=assignment.status,
        student_id=assignment.student_id,
        student_name=_get_student_name(student),
        tutor_id=assignment.tutor_id,
        tutor_name=_get_student_name(tutor),
        total_questions=assignment.question_count or 0,
        questions_answered=0,
        score_percentage=assignment.actual_score,
        due_date=assignment.due_date,
        created_at=assignment.created_at,
        is_adaptive=assignment.is_adaptive,
    )


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """
    Delete an assignment (tutor only).

    Only pending assignments can be deleted.
    """
    assignment = _get_assignment_or_404(
        assignment_id, db, current_user, require_tutor=True
    )

    if assignment.status != AssignmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending assignments can be deleted",
        )

    # Delete related assignment questions first
    db.query(AssignmentQuestion).filter(
        AssignmentQuestion.assignment_id == assignment.id
    ).delete()

    db.delete(assignment)
    db.commit()


@router.post("/{assignment_id}/start", response_model=AssignmentStatusUpdate)
def start_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentStatusUpdate:
    """
    Start working on an assignment (student only).

    Creates a test session linked to the assignment.
    For adaptive assignments, selects the first question using IRT.
    """
    assignment = _get_assignment_or_404(
        assignment_id, db, current_user, require_student=True
    )

    if assignment.status != AssignmentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start assignment with status '{assignment.status.value}'",
        )

    # Create test session for this assignment
    test_type = TestType.ADAPTIVE if assignment.is_adaptive else TestType.ASSIGNED
    session = TestSession(
        student_id=current_user.id,
        assignment_id=assignment.id,
        test_type=test_type,
        status=TestStatus.IN_PROGRESS,
        subject_area=SubjectArea(assignment.question_config.get("subject", "math")),
        total_questions=assignment.question_count,
        time_limit_minutes=assignment.time_limit_minutes,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()

    if assignment.is_adaptive:
        # For adaptive: select first question using IRT
        first_question = _select_adaptive_question_for_assignment(
            db, current_user.id, assignment, excluded_ids=[]
        )
        if not first_question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No questions available for adaptive assignment",
            )

        # Create AssignmentQuestion link
        aq = AssignmentQuestion(
            assignment_id=assignment.id,
            question_id=first_question.id,
            question_order=1,
        )
        db.add(aq)

        # Create TestQuestion
        tq = TestQuestion(
            test_session_id=session.id,
            question_id=first_question.id,
            question_order=1,
        )
        db.add(tq)
    else:
        # For regular assignments: link pre-selected questions to test session
        aqs = db.query(AssignmentQuestion).filter(
            AssignmentQuestion.assignment_id == assignment.id
        ).order_by(AssignmentQuestion.question_order).all()

        for aq in aqs:
            tq = TestQuestion(
                test_session_id=session.id,
                question_id=aq.question_id,
                question_order=aq.question_order,
            )
            db.add(tq)

    # Update assignment status
    assignment.status = AssignmentStatus.IN_PROGRESS
    assignment.started_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(assignment)

    return AssignmentStatusUpdate(
        id=assignment.id,
        status=assignment.status,
        current_question_index=0,
        started_at=assignment.started_at,
    )


@router.post("/{assignment_id}/answer", response_model=AssignmentAnswerResult)
def submit_assignment_answer(
    assignment_id: UUID,
    answer_data: AssignmentAnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentAnswerResult:
    """
    Submit an answer for a question in an assignment.
    Supports free navigation - can answer any question by ID.
    """
    assignment = _get_assignment_or_404(
        assignment_id, db, current_user, require_student=True
    )

    if assignment.status != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment is not in progress",
        )

    # Get test session
    session = db.query(TestSession).filter(
        TestSession.assignment_id == assignment.id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found",
        )

    # Find the test question - by question_id if provided, otherwise use current index
    if answer_data.question_id:
        test_question = db.query(TestQuestion).filter(
            TestQuestion.test_session_id == session.id,
            TestQuestion.question_id == answer_data.question_id,
        ).first()
    else:
        test_question = db.query(TestQuestion).filter(
            TestQuestion.test_session_id == session.id,
            TestQuestion.question_order == session.current_question_index + 1,
        ).first()

    if not test_question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question not found in this assignment",
        )

    question = test_question.question
    is_correct = _check_answer(question, answer_data.answer)

    # Check if already answered - if so, update the existing response
    existing_response = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session.id,
        StudentResponse.question_id == question.id,
    ).first()

    if existing_response:
        # Update existing response
        was_correct = existing_response.is_correct
        existing_response.response_json = answer_data.answer
        existing_response.is_correct = is_correct
        existing_response.time_spent_seconds += answer_data.time_spent_seconds
        existing_response.submitted_at = datetime.now(timezone.utc)

        # Update session correct count if answer correctness changed
        if was_correct and not is_correct:
            session.questions_correct = max(0, (session.questions_correct or 0) - 1)
        elif not was_correct and is_correct:
            session.questions_correct = (session.questions_correct or 0) + 1
    else:
        # Create new response
        response = StudentResponse(
            student_id=current_user.id,
            question_id=question.id,
            test_session_id=session.id,
            response_json=answer_data.answer,
            is_correct=is_correct,
            time_spent_seconds=answer_data.time_spent_seconds,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(response)

        # Update test question
        test_question.is_answered = True

        # Update session counters
        session.questions_answered = (session.questions_answered or 0) + 1
        if is_correct:
            session.questions_correct = (session.questions_correct or 0) + 1

    if session.time_spent_seconds is None:
        session.time_spent_seconds = answer_data.time_spent_seconds
    else:
        session.time_spent_seconds += answer_data.time_spent_seconds

    # For sequential mode (no question_id provided), advance to next question
    next_question_index = None
    assignment_complete = False

    # For adaptive assignments: update ability and select next question
    if assignment.is_adaptive and not existing_response:
        # Update student's ability estimate for this skill
        if question.skill_id:
            _update_ability_after_response(
                db, current_user.id, question.skill_id, question, is_correct
            )

        # Check if we need more questions
        questions_so_far = session.questions_answered or 0
        if questions_so_far < session.total_questions:
            # Get all used question IDs
            used_question_ids = [
                tq.question_id for tq in db.query(TestQuestion).filter(
                    TestQuestion.test_session_id == session.id
                ).all()
            ]

            # Select next question using IRT
            next_question = _select_adaptive_question_for_assignment(
                db, current_user.id, assignment, excluded_ids=used_question_ids
            )

            if next_question:
                next_order = questions_so_far + 1

                # Add to AssignmentQuestion
                aq = AssignmentQuestion(
                    assignment_id=assignment.id,
                    question_id=next_question.id,
                    question_order=next_order,
                )
                db.add(aq)

                # Add to TestQuestion
                tq = TestQuestion(
                    test_session_id=session.id,
                    question_id=next_question.id,
                    question_order=next_order,
                )
                db.add(tq)

                session.current_question_index = next_order - 1
                next_question_index = session.current_question_index
            else:
                # No more questions available
                assignment_complete = True
        else:
            assignment_complete = True
    elif not answer_data.question_id:
        # Non-adaptive sequential mode - advance current_question_index
        if session.current_question_index + 1 < session.total_questions:
            session.current_question_index += 1
            next_question_index = session.current_question_index
        else:
            assignment_complete = True

    db.commit()

    # Get explanation (with fallback to raw_import_json)
    explanation_html = question.explanation_html
    if not explanation_html and question.raw_import_json:
        explanation_html = question.raw_import_json.get("rationale_html")

    return AssignmentAnswerResult(
        is_correct=is_correct,
        correct_answer=question.correct_answer_json,
        explanation_html=explanation_html,
        next_question_index=next_question_index,
        assignment_complete=assignment_complete,
    )


@router.post("/{assignment_id}/submit", response_model=AssignmentComplete)
def submit_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentComplete:
    """
    Complete and submit an assignment.
    """
    assignment = _get_assignment_or_404(
        assignment_id, db, current_user, require_student=True
    )

    if assignment.status != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment cannot be submitted",
        )

    # Get test session
    session = db.query(TestSession).filter(
        TestSession.assignment_id == assignment.id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found",
        )

    # Calculate score based on total questions (unanswered = wrong)
    total = session.total_questions or assignment.question_count or 1
    score_percentage = ((session.questions_correct or 0) / total) * 100

    # Update session
    session.status = TestStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    session.score_percentage = score_percentage

    # Update assignment
    assignment.status = AssignmentStatus.COMPLETED
    assignment.completed_at = datetime.now(timezone.utc)
    assignment.actual_score = int(score_percentage)

    # Check if passed
    passed = True
    if assignment.target_score:
        passed = score_percentage >= assignment.target_score

    db.commit()
    db.refresh(assignment)

    return AssignmentComplete(
        id=assignment.id,
        status=assignment.status,
        score_percentage=score_percentage,
        questions_correct=session.questions_correct,
        total_questions=session.total_questions,
        target_score=assignment.target_score,
        passed=passed,
    )


@router.get("/{assignment_id}/questions", response_model=AssignmentQuestionsResponse)
def get_assignment_questions(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssignmentQuestionsResponse:
    """
    Get all questions for an assignment (for SAT-like test interface).

    Returns all questions with their current answer state.
    Only available for in-progress or completed assignments.
    """
    assignment = _get_assignment_or_404(assignment_id, db, current_user)

    # Get assignment questions
    aqs = db.query(AssignmentQuestion).filter(
        AssignmentQuestion.assignment_id == assignment.id
    ).order_by(AssignmentQuestion.question_order).all()

    # Get student responses for this assignment's session
    session = db.query(TestSession).filter(
        TestSession.assignment_id == assignment.id
    ).first()

    # Map question_id to response
    responses_map = {}
    if session:
        responses = db.query(StudentResponse).filter(
            StudentResponse.test_session_id == session.id
        ).all()
        for r in responses:
            responses_map[r.question_id] = r

    # Build question list
    questions = []
    for aq in aqs:
        q = aq.question
        response = responses_map.get(q.id)

        # Parse choices
        choices = None
        if q.choices_json:
            choices = [{"index": i, "content": c} for i, c in enumerate(q.choices_json)]

        # Extract stimulus_html from raw_import_json if available
        passage_html = None
        prompt_html = q.prompt_html
        explanation_html = q.explanation_html
        if q.raw_import_json and isinstance(q.raw_import_json, dict):
            stimulus_html = q.raw_import_json.get("stimulus_html")
            raw_prompt = q.raw_import_json.get("prompt_html")

            if stimulus_html:
                # For Reading/Writing, use separate prompt and passage to avoid duplication
                # raw_prompt has only the question, stimulus has the passage
                if q.subject_area and q.subject_area.value == "reading_writing":
                    passage_html = stimulus_html
                    # Use raw prompt if available (question only, no stimulus)
                    if raw_prompt:
                        prompt_html = raw_prompt
                else:
                    # For Math, stimulus is short (equations), combine with raw_prompt
                    # If database prompt_html only has the stimulus, use raw_prompt as the question
                    if raw_prompt and raw_prompt not in prompt_html:
                        prompt_html = f"{stimulus_html}\n\n{raw_prompt}"
                    elif stimulus_html not in prompt_html:
                        prompt_html = f"{stimulus_html}\n\n{prompt_html}"

            # Fallback to rationale_html from raw import if explanation_html is null
            if not explanation_html:
                explanation_html = q.raw_import_json.get("rationale_html")

        questions.append(AssignmentQuestionItem(
            order=aq.question_order,
            question_id=q.id,
            prompt_html=prompt_html,
            passage_html=passage_html,
            answer_type=q.answer_type.value if q.answer_type else "MCQ",
            choices=choices,
            is_answered=response is not None,
            selected_answer=response.response_json if response else None,
            correct_answer=q.correct_answer_json,
            explanation_html=explanation_html,
        ))

    return AssignmentQuestionsResponse(
        assignment_id=assignment.id,
        title=assignment.title,
        status=assignment.status,
        total_questions=assignment.question_count,
        time_limit_minutes=assignment.time_limit_minutes,
        questions=questions,
    )
