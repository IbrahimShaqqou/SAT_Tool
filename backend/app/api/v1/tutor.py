"""
SAT Tutoring Platform - Tutor Dashboard API

Endpoints for tutors to manage and monitor their students.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, and_, Float
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_tutor
from app.models.user import User
from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.assignment import Assignment
from app.models.test import TestSession
from app.models.response import StudentResponse, StudentSkill
from app.models.invite import Invite
from app.models.enums import UserRole, AssignmentStatus, TestStatus, InviteStatus
from app.schemas.tutor import (
    AddStudentRequest,
    StudentBrief,
    StudentListResponse,
    StudentProfile,
    StudentProgress,
    SkillProgress,
    DomainProgress,
    StudentSessionsResponse,
    SessionBrief,
    StudentResponsesResponse,
    ResponseItem,
    StudentWeaknesses,
    WeakSkill,
    TutorAnalytics,
    SkillStruggle,
)
from app.schemas.invite import (
    InviteCreate,
    InviteBrief,
    InviteListResponse,
    InviteDetail,
    InviteLink,
)

router = APIRouter()


def _get_student_or_404(student_id: UUID, tutor: User, db: Session) -> User:
    """Get a student that belongs to this tutor."""
    student = db.query(User).filter(
        User.id == student_id,
        User.tutor_id == tutor.id,
        User.role == UserRole.STUDENT,
    ).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found in your roster",
        )
    return student


def _calculate_accuracy(correct: int, total: int) -> float:
    """Calculate accuracy percentage."""
    if total == 0:
        return 0.0
    return round((correct / total) * 100, 1)


@router.get("/students", response_model=StudentListResponse)
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> StudentListResponse:
    """
    List tutor's students with summary stats.
    """
    students = db.query(User).filter(
        User.tutor_id == current_user.id,
        User.role == UserRole.STUDENT,
        User.is_active == True,
    ).all()

    items = []
    for student in students:
        # Get response stats
        total = db.query(func.count(StudentResponse.id)).filter(
            StudentResponse.student_id == student.id
        ).scalar() or 0

        correct = db.query(func.count(StudentResponse.id)).filter(
            StudentResponse.student_id == student.id,
            StudentResponse.is_correct == True,
        ).scalar() or 0

        # Get pending assignments
        pending = db.query(func.count(Assignment.id)).filter(
            Assignment.student_id == student.id,
            Assignment.status == AssignmentStatus.PENDING,
        ).scalar() or 0

        # Get last activity
        last_response = db.query(StudentResponse.submitted_at).filter(
            StudentResponse.student_id == student.id
        ).order_by(StudentResponse.submitted_at.desc()).first()

        items.append(StudentBrief(
            id=student.id,
            email=student.email,
            first_name=student.first_name,
            last_name=student.last_name,
            overall_accuracy=_calculate_accuracy(correct, total) if total > 0 else None,
            total_questions_answered=total,
            assignments_pending=pending,
            last_active_at=last_response[0] if last_response else None,
        ))

    return StudentListResponse(items=items, total=len(items))


@router.post("/students", response_model=StudentBrief, status_code=status.HTTP_201_CREATED)
def add_student(
    request: AddStudentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> StudentBrief:
    """
    Add a student to tutor's roster by email.
    """
    student = db.query(User).filter(
        User.email == request.student_email,
        User.role == UserRole.STUDENT,
        User.is_active == True,
    ).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found with this email",
        )

    if student.tutor_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is already in your roster",
        )

    if student.tutor_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student already has a tutor assigned",
        )

    student.tutor_id = current_user.id
    db.commit()
    db.refresh(student)

    return StudentBrief(
        id=student.id,
        email=student.email,
        first_name=student.first_name,
        last_name=student.last_name,
        overall_accuracy=None,
        total_questions_answered=0,
        assignments_pending=0,
        last_active_at=None,
    )


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """
    Remove a student from tutor's roster.
    """
    student = _get_student_or_404(student_id, current_user, db)
    student.tutor_id = None
    db.commit()


@router.get("/students/{student_id}", response_model=StudentProfile)
def get_student_profile(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> StudentProfile:
    """
    Get full student profile.
    """
    student = _get_student_or_404(student_id, current_user, db)

    # Get response stats
    total = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == student.id
    ).scalar() or 0

    correct = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == student.id,
        StudentResponse.is_correct == True,
    ).scalar() or 0

    # Get session stats
    sessions_completed = db.query(func.count(TestSession.id)).filter(
        TestSession.student_id == student.id,
        TestSession.status == TestStatus.COMPLETED,
    ).scalar() or 0

    # Get assignment stats
    assignments_total = db.query(func.count(Assignment.id)).filter(
        Assignment.student_id == student.id
    ).scalar() or 0

    assignments_completed = db.query(func.count(Assignment.id)).filter(
        Assignment.student_id == student.id,
        Assignment.status == AssignmentStatus.COMPLETED,
    ).scalar() or 0

    # Get last activity
    last_response = db.query(StudentResponse.submitted_at).filter(
        StudentResponse.student_id == student.id
    ).order_by(StudentResponse.submitted_at.desc()).first()

    return StudentProfile(
        id=student.id,
        email=student.email,
        first_name=student.first_name,
        last_name=student.last_name,
        created_at=student.created_at,
        overall_accuracy=_calculate_accuracy(correct, total) if total > 0 else None,
        total_questions_answered=total,
        total_correct=correct,
        sessions_completed=sessions_completed,
        assignments_total=assignments_total,
        assignments_completed=assignments_completed,
        last_active_at=last_response[0] if last_response else None,
    )


@router.get("/students/{student_id}/progress", response_model=StudentProgress)
def get_student_progress(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> StudentProgress:
    """
    Get complete student progress with skill and domain breakdown.
    """
    student = _get_student_or_404(student_id, current_user, db)

    # Get overall stats
    total = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == student.id
    ).scalar() or 0

    correct = db.query(func.count(StudentResponse.id)).filter(
        StudentResponse.student_id == student.id,
        StudentResponse.is_correct == True,
    ).scalar() or 0

    sessions_completed = db.query(func.count(TestSession.id)).filter(
        TestSession.student_id == student.id,
        TestSession.status == TestStatus.COMPLETED,
    ).scalar() or 0

    # Get skill progress from StudentSkill table
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == student.id
    ).all()

    skills = []
    for sr in skill_records:
        skill = db.query(Skill).filter(Skill.id == sr.skill_id).first()
        if skill:
            domain = db.query(Domain).filter(Domain.id == skill.domain_id).first()
            skills.append(SkillProgress(
                skill_id=skill.id,
                skill_name=skill.name,
                skill_code=skill.code,
                domain_name=domain.name if domain else "Unknown",
                accuracy=_calculate_accuracy(sr.questions_correct, sr.questions_attempted),
                questions_attempted=sr.questions_attempted,
                ability_theta=round(sr.ability_theta, 2) if sr.ability_theta is not None else None,
                ability_se=round(sr.ability_se, 2) if sr.ability_se is not None else None,
            ))

    # Calculate domain progress from skill progress
    domain_stats = {}
    for sr in skill_records:
        skill = db.query(Skill).filter(Skill.id == sr.skill_id).first()
        if skill and skill.domain_id:
            if skill.domain_id not in domain_stats:
                domain_stats[skill.domain_id] = {"correct": 0, "total": 0}
            domain_stats[skill.domain_id]["correct"] += sr.questions_correct
            domain_stats[skill.domain_id]["total"] += sr.questions_attempted

    domains = []
    for domain_id, stats in domain_stats.items():
        domain = db.query(Domain).filter(Domain.id == domain_id).first()
        if domain:
            domains.append(DomainProgress(
                domain_id=domain.id,
                domain_name=domain.name,
                domain_code=domain.code,
                subject_area=domain.subject_area,
                accuracy=_calculate_accuracy(stats["correct"], stats["total"]),
                questions_attempted=stats["total"],
            ))

    return StudentProgress(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        overall_accuracy=_calculate_accuracy(correct, total),
        total_questions_answered=total,
        sessions_completed=sessions_completed,
        skills=skills,
        domains=domains,
    )


@router.get("/students/{student_id}/sessions", response_model=StudentSessionsResponse)
def get_student_sessions(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> StudentSessionsResponse:
    """
    Get all practice sessions for a student.
    """
    student = _get_student_or_404(student_id, current_user, db)

    query = db.query(TestSession).filter(TestSession.student_id == student.id)
    total = query.count()

    sessions = query.order_by(
        TestSession.created_at.desc()
    ).offset(offset).limit(limit).all()

    items = [
        SessionBrief(
            id=s.id,
            test_type=s.test_type.value,
            status=s.status.value,
            subject_area=s.subject_area.value if s.subject_area else None,
            total_questions=s.total_questions,
            questions_answered=s.questions_answered,
            score_percentage=s.score_percentage,
            started_at=s.started_at,
            completed_at=s.completed_at,
        )
        for s in sessions
    ]

    return StudentSessionsResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/students/{student_id}/responses", response_model=StudentResponsesResponse)
def get_student_responses(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
    skill_id: Optional[int] = Query(None),
    is_correct: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> StudentResponsesResponse:
    """
    Get full response history for a student.
    """
    student = _get_student_or_404(student_id, current_user, db)

    query = db.query(StudentResponse).filter(
        StudentResponse.student_id == student.id
    )

    if is_correct is not None:
        query = query.filter(StudentResponse.is_correct == is_correct)

    # Filter by skill requires joining with Question
    if skill_id:
        query = query.join(Question).filter(Question.skill_id == skill_id)

    total = query.count()

    responses = query.order_by(
        StudentResponse.submitted_at.desc()
    ).offset(offset).limit(limit).all()

    items = []
    for r in responses:
        question = db.query(Question).filter(Question.id == r.question_id).first()
        skill_name = None
        if question and question.skill_id:
            skill = db.query(Skill).filter(Skill.id == question.skill_id).first()
            if skill:
                skill_name = skill.name

        items.append(ResponseItem(
            id=r.id,
            question_id=r.question_id,
            question_prompt=question.prompt_html if question else "",
            skill_name=skill_name,
            your_answer=r.response_json,
            correct_answer=question.correct_answer_json if question else {},
            is_correct=r.is_correct,
            time_spent_seconds=r.time_spent_seconds,
            submitted_at=r.submitted_at,
        ))

    return StudentResponsesResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/students/{student_id}/weaknesses", response_model=StudentWeaknesses)
def get_student_weaknesses(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> StudentWeaknesses:
    """
    Identify weak skills that need practice.
    """
    student = _get_student_or_404(student_id, current_user, db)

    # Get skill stats from StudentSkill
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == student.id,
        StudentSkill.questions_attempted >= 3,  # Minimum attempts for meaningful data
    ).all()

    weak_skills = []
    for sr in skill_records:
        accuracy = _calculate_accuracy(sr.questions_correct, sr.questions_attempted)
        if accuracy < 70:  # Threshold for "weak"
            skill = db.query(Skill).filter(Skill.id == sr.skill_id).first()
            if skill:
                priority = "high" if accuracy < 50 else "medium" if accuracy < 60 else "low"
                weak_skills.append(WeakSkill(
                    skill_id=skill.id,
                    skill_name=skill.name,
                    skill_code=skill.code,
                    accuracy=accuracy,
                    questions_attempted=sr.questions_attempted,
                    priority=priority,
                ))

    # Sort by accuracy (lowest first)
    weak_skills.sort(key=lambda x: x.accuracy)

    # Recommend focus on worst skill
    recommended = None
    if weak_skills:
        worst = weak_skills[0]
        skill = db.query(Skill).filter(Skill.id == worst.skill_id).first()
        if skill:
            domain = db.query(Domain).filter(Domain.id == skill.domain_id).first()
            recommended = {
                "subject": domain.subject_area.value if domain else "math",
                "skill_id": worst.skill_id,
                "question_count": 10,
            }

    return StudentWeaknesses(
        weak_skills=weak_skills,
        recommended_focus=recommended,
    )


@router.get("/analytics", response_model=TutorAnalytics)
def get_tutor_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> TutorAnalytics:
    """
    Get aggregate analytics across all students.
    """
    # Get student IDs
    student_ids = [s.id for s in db.query(User.id).filter(
        User.tutor_id == current_user.id,
        User.role == UserRole.STUDENT,
    ).all()]

    total_students = len(student_ids)

    # Active students this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_this_week = 0
    if student_ids:
        active_this_week = db.query(func.count(func.distinct(StudentResponse.student_id))).filter(
            StudentResponse.student_id.in_(student_ids),
            StudentResponse.submitted_at >= week_ago,
        ).scalar() or 0

    # Assignment stats
    total_assignments = db.query(func.count(Assignment.id)).filter(
        Assignment.tutor_id == current_user.id
    ).scalar() or 0

    assignments_completed = db.query(func.count(Assignment.id)).filter(
        Assignment.tutor_id == current_user.id,
        Assignment.status == AssignmentStatus.COMPLETED,
    ).scalar() or 0

    # Average score
    avg_score = 0.0
    if student_ids:
        score_result = db.query(func.avg(Assignment.actual_score)).filter(
            Assignment.tutor_id == current_user.id,
            Assignment.actual_score != None,
        ).scalar()
        avg_score = round(float(score_result), 1) if score_result else 0.0

    # Common struggles - aggregate across all students
    common_struggles = []
    if student_ids:
        # Get skill stats across all students
        skill_stats = db.query(
            StudentSkill.skill_id,
            func.sum(StudentSkill.questions_correct).label("total_correct"),
            func.sum(StudentSkill.questions_attempted).label("total_attempted"),
            func.count(StudentSkill.student_id).label("student_count"),
        ).filter(
            StudentSkill.student_id.in_(student_ids),
            StudentSkill.questions_attempted >= 3,
        ).group_by(StudentSkill.skill_id).all()

        for stat in skill_stats:
            accuracy = _calculate_accuracy(
                int(stat.total_correct or 0),
                int(stat.total_attempted or 0)
            )
            if accuracy < 70:
                skill = db.query(Skill).filter(Skill.id == stat.skill_id).first()
                if skill:
                    common_struggles.append(SkillStruggle(
                        skill_id=skill.id,
                        skill_name=skill.name,
                        avg_accuracy=accuracy,
                        students_struggling=stat.student_count,
                    ))

        # Sort by number of struggling students
        common_struggles.sort(key=lambda x: (-x.students_struggling, x.avg_accuracy))
        common_struggles = common_struggles[:5]  # Top 5

    return TutorAnalytics(
        total_students=total_students,
        active_students_this_week=active_this_week,
        total_assignments_created=total_assignments,
        assignments_completed=assignments_completed,
        average_score=avg_score,
        common_struggles=common_struggles,
    )


# ============================================================================
# Invite Link Endpoints
# ============================================================================

@router.post("/invites", response_model=InviteLink, status_code=status.HTTP_201_CREATED)
def create_invite(
    request: InviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> InviteLink:
    """
    Generate a new assessment invite link.
    """
    # Calculate expiration if specified
    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=request.expires_in_days)

    invite = Invite(
        tutor_id=current_user.id,
        title=request.title or "Intake Assessment",
        assessment_type=request.assessment_type,
        subject_area=request.subject_area,
        question_count=request.question_count,
        time_limit_minutes=request.time_limit_minutes,
        is_adaptive=1 if request.is_adaptive else 0,
        expires_at=expires_at,
    )

    db.add(invite)
    db.commit()
    db.refresh(invite)

    # Generate the full link (frontend URL)
    # In production, this would use a config setting for the base URL
    link = f"/assess/{invite.token}"

    return InviteLink(
        id=invite.id,
        token=invite.token,
        link=link,
        expires_at=invite.expires_at,
    )


@router.get("/invites", response_model=InviteListResponse)
def list_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
    status_filter: Optional[InviteStatus] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> InviteListResponse:
    """
    List all invite links created by this tutor.
    """
    query = db.query(Invite).filter(Invite.tutor_id == current_user.id)

    if status_filter:
        query = query.filter(Invite.status == status_filter)

    total = query.count()

    invites = query.order_by(Invite.created_at.desc()).offset(offset).limit(limit).all()

    items = []
    for inv in invites:
        # Get score if assessment was completed
        score_percentage = None
        if inv.test_session_id:
            session = db.query(TestSession).filter(TestSession.id == inv.test_session_id).first()
            if session:
                score_percentage = session.score_percentage

        items.append(InviteBrief(
            id=inv.id,
            token=inv.token,
            title=inv.title,
            assessment_type=inv.assessment_type,
            subject_area=inv.subject_area,
            question_count=inv.question_count,
            time_limit_minutes=inv.time_limit_minutes,
            status=inv.status,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
            used_at=inv.used_at,
            guest_name=inv.guest_name,
            guest_email=inv.guest_email,
            student_id=inv.student_id,
            score_percentage=score_percentage,
        ))

    return InviteListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/invites/{invite_id}", response_model=InviteDetail)
def get_invite(
    invite_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> InviteDetail:
    """
    Get details of a specific invite.
    """
    invite = db.query(Invite).filter(
        Invite.id == invite_id,
        Invite.tutor_id == current_user.id,
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    return InviteDetail(
        id=invite.id,
        token=invite.token,
        title=invite.title,
        subject_area=invite.subject_area,
        question_count=invite.question_count,
        time_limit_minutes=invite.time_limit_minutes,
        status=invite.status,
        created_at=invite.created_at,
        expires_at=invite.expires_at,
        used_at=invite.used_at,
        guest_name=invite.guest_name,
        guest_email=invite.guest_email,
        student_id=invite.student_id,
        test_session_id=invite.test_session_id,
    )


@router.get("/invites/{invite_id}/results")
def get_invite_results(
    invite_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """
    Get detailed assessment results for an invite (skill/domain breakdown).
    """
    from app.services.intake_service import calculate_intake_results

    invite = db.query(Invite).filter(
        Invite.id == invite_id,
        Invite.tutor_id == current_user.id,
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    if not invite.test_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment not started",
        )

    session = db.query(TestSession).filter(TestSession.id == invite.test_session_id).first()
    if not session or session.status != TestStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assessment not completed",
        )

    # Get detailed results
    results = calculate_intake_results(db, session.id)

    # Add session info
    student = None
    if invite.student_id:
        student = db.query(User).filter(User.id == invite.student_id).first()

    return {
        "invite_id": invite.id,
        "title": invite.title,
        "student_id": invite.student_id,
        "student_name": f"{student.first_name} {student.last_name}" if student else invite.guest_name,
        "student_email": student.email if student else invite.guest_email,
        "completed_at": session.completed_at,
        "time_spent_seconds": session.time_spent_seconds,
        "score_percentage": session.score_percentage,
        **results,
    }


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    invite_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
):
    """
    Revoke an invite link (can only revoke active invites).
    """
    invite = db.query(Invite).filter(
        Invite.id == invite_id,
        Invite.tutor_id == current_user.id,
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found",
        )

    if invite.status != InviteStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke invite with status: {invite.status.value}",
        )

    invite.status = InviteStatus.REVOKED
    db.commit()


# ============================================================================
# Chart Data Endpoints
# ============================================================================

from app.schemas.tutor import (
    TutorChartData,
    StudentChartData,
    AccuracyDataPoint,
    SkillChartData,
    DomainChartData,
    ActivityDay,
)


@router.get("/charts", response_model=TutorChartData)
def get_tutor_chart_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
    days: int = Query(30, ge=7, le=90),
) -> TutorChartData:
    """
    Get chart data for tutor analytics dashboard.
    """
    # Get all tutor's students
    student_ids = [s.id for s in db.query(User).filter(User.tutor_id == current_user.id).all()]

    if not student_ids:
        return TutorChartData(
            accuracy_trend=[],
            skill_breakdown=[],
            domain_performance=[],
            activity_heatmap=[],
        )

    # Accuracy trend - aggregate by date
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Get responses grouped by date
    date_responses = db.query(
        func.date(StudentResponse.submitted_at).label('date'),
        func.avg(func.cast(StudentResponse.is_correct, Float)).label('accuracy'),
    ).filter(
        StudentResponse.student_id.in_(student_ids),
        StudentResponse.submitted_at >= cutoff_date,
    ).group_by(
        func.date(StudentResponse.submitted_at)
    ).order_by(
        func.date(StudentResponse.submitted_at)
    ).all()

    accuracy_trend = [
        AccuracyDataPoint(
            date=str(r.date),
            accuracy=round((r.accuracy or 0) * 100, 1),
        )
        for r in date_responses
    ]

    # Skill breakdown - top 10 skills by question count
    skill_stats = db.query(
        Skill.name,
        func.count(StudentResponse.id).label('questions'),
        func.avg(func.cast(StudentResponse.is_correct, Float)).label('accuracy'),
    ).join(
        Question, Question.skill_id == Skill.id
    ).join(
        StudentResponse, StudentResponse.question_id == Question.id
    ).filter(
        StudentResponse.student_id.in_(student_ids),
    ).group_by(
        Skill.id, Skill.name
    ).order_by(
        func.count(StudentResponse.id).desc()
    ).limit(10).all()

    skill_breakdown = [
        SkillChartData(
            name=s.name[:30],  # Truncate long names
            accuracy=round((s.accuracy or 0) * 100, 1),
            questions=s.questions,
        )
        for s in skill_stats
    ]

    # Domain performance
    domain_stats = db.query(
        Domain.name,
        func.avg(func.cast(StudentResponse.is_correct, Float)).label('accuracy'),
    ).join(
        Question, Question.domain_id == Domain.id
    ).join(
        StudentResponse, StudentResponse.question_id == Question.id
    ).filter(
        StudentResponse.student_id.in_(student_ids),
    ).group_by(
        Domain.id, Domain.name
    ).all()

    domain_performance = [
        DomainChartData(
            domain=d.name,
            accuracy=round((d.accuracy or 0) * 100, 1),
        )
        for d in domain_stats
    ]

    # Activity heatmap - past 30 days
    activity = db.query(
        func.date(StudentResponse.submitted_at).label('date'),
        func.count(StudentResponse.id).label('count'),
    ).filter(
        StudentResponse.student_id.in_(student_ids),
        StudentResponse.submitted_at >= cutoff_date,
    ).group_by(
        func.date(StudentResponse.submitted_at)
    ).all()

    activity_heatmap = [
        ActivityDay(date=str(a.date), count=a.count)
        for a in activity
    ]

    return TutorChartData(
        accuracy_trend=accuracy_trend,
        skill_breakdown=skill_breakdown,
        domain_performance=domain_performance,
        activity_heatmap=activity_heatmap,
    )


@router.get("/students/{student_id}/charts", response_model=StudentChartData)
def get_student_chart_data(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
    days: int = Query(30, ge=7, le=90),
) -> StudentChartData:
    """
    Get chart data for individual student detail page.
    """
    # Verify student belongs to tutor
    student = db.query(User).filter(
        User.id == student_id,
        User.tutor_id == current_user.id,
    ).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Accuracy trend
    date_responses = db.query(
        func.date(StudentResponse.submitted_at).label('date'),
        func.avg(func.cast(StudentResponse.is_correct, Float)).label('accuracy'),
    ).filter(
        StudentResponse.student_id == student_id,
        StudentResponse.submitted_at >= cutoff_date,
    ).group_by(
        func.date(StudentResponse.submitted_at)
    ).order_by(
        func.date(StudentResponse.submitted_at)
    ).all()

    accuracy_trend = [
        AccuracyDataPoint(
            date=str(r.date),
            accuracy=round((r.accuracy or 0) * 100, 1),
        )
        for r in date_responses
    ]

    # Skill breakdown
    skill_stats = db.query(
        Skill.name,
        func.count(StudentResponse.id).label('questions'),
        func.avg(func.cast(StudentResponse.is_correct, Float)).label('accuracy'),
    ).join(
        Question, Question.skill_id == Skill.id
    ).join(
        StudentResponse, StudentResponse.question_id == Question.id
    ).filter(
        StudentResponse.student_id == student_id,
    ).group_by(
        Skill.id, Skill.name
    ).order_by(
        func.count(StudentResponse.id).desc()
    ).limit(10).all()

    skill_breakdown = [
        SkillChartData(
            name=s.name[:30],
            accuracy=round((s.accuracy or 0) * 100, 1),
            questions=s.questions,
        )
        for s in skill_stats
    ]

    # Domain performance
    domain_stats = db.query(
        Domain.name,
        func.avg(func.cast(StudentResponse.is_correct, Float)).label('accuracy'),
    ).join(
        Question, Question.domain_id == Domain.id
    ).join(
        StudentResponse, StudentResponse.question_id == Question.id
    ).filter(
        StudentResponse.student_id == student_id,
    ).group_by(
        Domain.id, Domain.name
    ).all()

    domain_performance = [
        DomainChartData(
            domain=d.name,
            accuracy=round((d.accuracy or 0) * 100, 1),
        )
        for d in domain_stats
    ]

    return StudentChartData(
        accuracy_trend=accuracy_trend,
        skill_breakdown=skill_breakdown,
        domain_performance=domain_performance,
    )
