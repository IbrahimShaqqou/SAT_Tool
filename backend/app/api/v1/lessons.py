"""
ZooPrep - Lessons API

Endpoints for lesson content management and completion tracking.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user
from app.models import User, Lesson, LessonCompletion, LessonStatus, Domain, Skill
from app.models.enums import SubjectArea
from app.schemas.lesson import (
    LessonListItem,
    LessonDetail,
    LessonsByDomain,
    LessonsResponse,
    LessonCreate,
    LessonUpdate,
    LessonCompletionCreate,
    LessonCompletionResponse,
)

router = APIRouter()


def get_lesson_with_completion(lesson: Lesson, student_id: UUID, db: Session) -> dict:
    """Helper to add completion status to lesson data"""
    completion = db.query(LessonCompletion).filter(
        and_(
            LessonCompletion.lesson_id == lesson.id,
            LessonCompletion.student_id == student_id
        )
    ).first()

    return {
        "id": lesson.id,
        "skill_id": lesson.skill_id,
        "skill_name": lesson.skill.name if lesson.skill else None,
        "skill_code": lesson.skill.code if lesson.skill else None,
        "domain_id": lesson.domain_id,
        "domain_name": lesson.domain.name if lesson.domain else None,
        "domain_code": lesson.domain.code if lesson.domain else None,
        "title": lesson.title,
        "subtitle": lesson.subtitle,
        "status": lesson.status,
        "estimated_minutes": lesson.estimated_minutes,
        "difficulty_level": lesson.difficulty_level,
        "icon": lesson.icon,
        "color": lesson.color,
        "cover_image_url": lesson.cover_image_url,
        "display_order": lesson.display_order,
        "is_completed": completion is not None and completion.progress_percent >= 100,
        "completion_percent": completion.progress_percent if completion else 0,
    }


@router.get("/math", response_model=LessonsResponse)
def get_math_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get all math lessons grouped by domain.

    Returns lessons for all math domains with completion status.
    """
    # Get all math domains
    domains = db.query(Domain).filter(
        Domain.subject_area == SubjectArea.math,
        Domain.is_active == True
    ).order_by(Domain.display_order).all()

    result_domains = []
    total_lessons = 0
    total_completed = 0

    for domain in domains:
        # Get lessons for this domain
        lessons = db.query(Lesson).options(
            joinedload(Lesson.skill),
            joinedload(Lesson.domain)
        ).filter(
            Lesson.domain_id == domain.id,
            Lesson.is_active == True
        ).order_by(Lesson.display_order).all()

        # Add completion status
        lesson_items = []
        completed_count = 0
        for lesson in lessons:
            lesson_data = get_lesson_with_completion(lesson, current_user.id, db)
            lesson_items.append(lesson_data)
            if lesson_data["is_completed"]:
                completed_count += 1

        result_domains.append({
            "domain_id": domain.id,
            "domain_code": domain.code,
            "domain_name": domain.name,
            "subject_area": "math",
            "lessons": lesson_items,
            "total_lessons": len(lessons),
            "completed_lessons": completed_count,
        })

        total_lessons += len(lessons)
        total_completed += completed_count

    return {
        "subject_area": "math",
        "domains": result_domains,
        "total_lessons": total_lessons,
        "completed_lessons": total_completed,
    }


@router.get("/reading", response_model=LessonsResponse)
def get_reading_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get all reading/writing lessons grouped by domain.

    Returns lessons for all reading domains with completion status.
    """
    # Get all reading domains
    domains = db.query(Domain).filter(
        Domain.subject_area == SubjectArea.reading_writing,
        Domain.is_active == True
    ).order_by(Domain.display_order).all()

    result_domains = []
    total_lessons = 0
    total_completed = 0

    for domain in domains:
        lessons = db.query(Lesson).options(
            joinedload(Lesson.skill),
            joinedload(Lesson.domain)
        ).filter(
            Lesson.domain_id == domain.id,
            Lesson.is_active == True
        ).order_by(Lesson.display_order).all()

        lesson_items = []
        completed_count = 0
        for lesson in lessons:
            lesson_data = get_lesson_with_completion(lesson, current_user.id, db)
            lesson_items.append(lesson_data)
            if lesson_data["is_completed"]:
                completed_count += 1

        result_domains.append({
            "domain_id": domain.id,
            "domain_code": domain.code,
            "domain_name": domain.name,
            "subject_area": "reading_writing",
            "lessons": lesson_items,
            "total_lessons": len(lessons),
            "completed_lessons": completed_count,
        })

        total_lessons += len(lessons)
        total_completed += completed_count

    return {
        "subject_area": "reading_writing",
        "domains": result_domains,
        "total_lessons": total_lessons,
        "completed_lessons": total_completed,
    }


@router.get("/skill/{skill_id}", response_model=LessonDetail)
def get_lesson_by_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get lesson for a specific skill.

    Args:
        skill_id: The skill ID to get lesson for

    Returns:
        Full lesson content with completion status
    """
    lesson = db.query(Lesson).options(
        joinedload(Lesson.skill),
        joinedload(Lesson.domain)
    ).filter(
        Lesson.skill_id == skill_id,
        Lesson.is_active == True
    ).first()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No lesson found for this skill"
        )

    # Get completion status
    completion = db.query(LessonCompletion).filter(
        and_(
            LessonCompletion.lesson_id == lesson.id,
            LessonCompletion.student_id == current_user.id
        )
    ).first()

    return {
        "id": lesson.id,
        "skill_id": lesson.skill_id,
        "skill_name": lesson.skill.name if lesson.skill else None,
        "skill_code": lesson.skill.code if lesson.skill else None,
        "domain_id": lesson.domain_id,
        "domain_name": lesson.domain.name if lesson.domain else None,
        "domain_code": lesson.domain.code if lesson.domain else None,
        "title": lesson.title,
        "subtitle": lesson.subtitle,
        "status": lesson.status,
        "content": lesson.content_json,
        "estimated_minutes": lesson.estimated_minutes,
        "difficulty_level": lesson.difficulty_level,
        "icon": lesson.icon,
        "color": lesson.color,
        "cover_image_url": lesson.cover_image_url,
        "is_completed": completion is not None and completion.progress_percent >= 100,
        "completion_percent": completion.progress_percent if completion else 0,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
    }


@router.get("/{lesson_id}", response_model=LessonDetail)
def get_lesson(
    lesson_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get a specific lesson by ID.

    Args:
        lesson_id: The lesson UUID

    Returns:
        Full lesson content with completion status
    """
    lesson = db.query(Lesson).options(
        joinedload(Lesson.skill),
        joinedload(Lesson.domain)
    ).filter(
        Lesson.id == lesson_id,
        Lesson.is_active == True
    ).first()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )

    # Get completion status
    completion = db.query(LessonCompletion).filter(
        and_(
            LessonCompletion.lesson_id == lesson.id,
            LessonCompletion.student_id == current_user.id
        )
    ).first()

    return {
        "id": lesson.id,
        "skill_id": lesson.skill_id,
        "skill_name": lesson.skill.name if lesson.skill else None,
        "skill_code": lesson.skill.code if lesson.skill else None,
        "domain_id": lesson.domain_id,
        "domain_name": lesson.domain.name if lesson.domain else None,
        "domain_code": lesson.domain.code if lesson.domain else None,
        "title": lesson.title,
        "subtitle": lesson.subtitle,
        "status": lesson.status,
        "content": lesson.content_json,
        "estimated_minutes": lesson.estimated_minutes,
        "difficulty_level": lesson.difficulty_level,
        "icon": lesson.icon,
        "color": lesson.color,
        "cover_image_url": lesson.cover_image_url,
        "is_completed": completion is not None and completion.progress_percent >= 100,
        "completion_percent": completion.progress_percent if completion else 0,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
    }


@router.post("/{lesson_id}/complete", response_model=LessonCompletionResponse)
def mark_lesson_complete(
    lesson_id: UUID,
    body: LessonCompletionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Mark a lesson as completed.

    Args:
        lesson_id: The lesson UUID
        body: Completion details (time spent, progress)

    Returns:
        Completion status
    """
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )

    # Check if already completed
    completion = db.query(LessonCompletion).filter(
        and_(
            LessonCompletion.lesson_id == lesson_id,
            LessonCompletion.student_id == current_user.id
        )
    ).first()

    if completion:
        # Update existing completion
        completion.time_spent_seconds += body.time_spent_seconds
        completion.progress_percent = max(completion.progress_percent, body.progress_percent)
    else:
        # Create new completion
        completion = LessonCompletion(
            lesson_id=lesson_id,
            student_id=current_user.id,
            time_spent_seconds=body.time_spent_seconds,
            progress_percent=body.progress_percent,
        )
        db.add(completion)

    db.commit()
    db.refresh(completion)

    return {
        "lesson_id": completion.lesson_id,
        "is_completed": completion.progress_percent >= 100,
        "progress_percent": completion.progress_percent,
        "time_spent_seconds": completion.time_spent_seconds,
        "completed_at": completion.updated_at,
    }


# Admin endpoints for creating/updating lessons
@router.post("/", response_model=LessonListItem, status_code=status.HTTP_201_CREATED)
def create_lesson(
    body: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Create a new lesson (tutor/admin only).
    """
    # Check if user is tutor
    if current_user.role.value.lower() != "tutor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tutors can create lessons"
        )

    # Check if skill exists
    skill = db.query(Skill).filter(Skill.id == body.skill_id).first()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found"
        )

    # Check if lesson already exists for this skill
    existing = db.query(Lesson).filter(Lesson.skill_id == body.skill_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A lesson already exists for this skill"
        )

    lesson = Lesson(
        skill_id=body.skill_id,
        domain_id=skill.domain_id,
        title=body.title,
        subtitle=body.subtitle,
        status=body.status,
        content_json=body.content,
        estimated_minutes=body.estimated_minutes,
        difficulty_level=body.difficulty_level,
        icon=body.icon,
        color=body.color,
        cover_image_url=body.cover_image_url,
        display_order=body.display_order,
    )

    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return get_lesson_with_completion(lesson, current_user.id, db)


@router.patch("/{lesson_id}", response_model=LessonListItem)
def update_lesson(
    lesson_id: UUID,
    body: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Update an existing lesson (tutor/admin only).
    """
    if current_user.role.value.lower() != "tutor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only tutors can update lessons"
        )

    lesson = db.query(Lesson).options(
        joinedload(Lesson.skill),
        joinedload(Lesson.domain)
    ).filter(Lesson.id == lesson_id).first()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )

    # Update fields
    update_data = body.model_dump(exclude_unset=True)
    if "content" in update_data:
        update_data["content_json"] = update_data.pop("content")

    for field, value in update_data.items():
        setattr(lesson, field, value)

    db.commit()
    db.refresh(lesson)

    return get_lesson_with_completion(lesson, current_user.id, db)
