"""
SAT Tutoring Platform - Taxonomy API

Endpoints for browsing domains and skills.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.taxonomy import Domain, Skill
from app.models.question import Question
from app.schemas.taxonomy import (
    DomainResponse,
    DomainListResponse,
    SkillResponse,
    SkillListResponse,
)
from app.schemas.question import DomainBrief

router = APIRouter()


@router.get("/domains", response_model=DomainListResponse)
def list_domains(
    db: Session = Depends(get_db),
) -> DomainListResponse:
    """
    List all domains with question counts.

    Returns domains grouped by subject area (Math and Reading/Writing).
    """
    # Get all active domains with question counts
    domains = db.query(Domain).filter(Domain.is_active == True).order_by(
        Domain.subject_area,
        Domain.display_order,
    ).all()

    # Get question counts per domain
    question_counts = dict(
        db.query(Question.domain_id, func.count(Question.id))
        .filter(Question.is_active == True, Question.deleted_at == None)
        .group_by(Question.domain_id)
        .all()
    )

    items = []
    for domain in domains:
        items.append(DomainResponse(
            id=domain.id,
            code=domain.code,
            name=domain.name,
            subject_area=domain.subject_area,
            description=domain.description,
            question_count=question_counts.get(domain.id, 0),
        ))

    return DomainListResponse(items=items)


@router.get("/domains/{domain_id}", response_model=DomainResponse)
def get_domain(
    domain_id: int,
    db: Session = Depends(get_db),
) -> DomainResponse:
    """
    Get a single domain by ID with question count.
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.is_active == True,
    ).first()

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found",
        )

    question_count = db.query(func.count(Question.id)).filter(
        Question.domain_id == domain_id,
        Question.is_active == True,
        Question.deleted_at == None,
    ).scalar()

    return DomainResponse(
        id=domain.id,
        code=domain.code,
        name=domain.name,
        subject_area=domain.subject_area,
        description=domain.description,
        question_count=question_count or 0,
    )


@router.get("/domains/{domain_id}/skills", response_model=SkillListResponse)
def list_skills_by_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SkillListResponse:
    """
    List all skills in a domain with question counts.
    """
    # Verify domain exists
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found",
        )

    # Get skills in this domain
    query = db.query(Skill).filter(
        Skill.domain_id == domain_id,
        Skill.is_active == True,
    )

    total = query.count()
    skills = query.order_by(Skill.display_order).offset(offset).limit(limit).all()

    # Get question counts per skill
    skill_ids = [s.id for s in skills]
    question_counts = dict(
        db.query(Question.skill_id, func.count(Question.id))
        .filter(
            Question.skill_id.in_(skill_ids),
            Question.is_active == True,
            Question.deleted_at == None,
        )
        .group_by(Question.skill_id)
        .all()
    ) if skill_ids else {}

    domain_brief = DomainBrief(id=domain.id, code=domain.code, name=domain.name)

    items = []
    for skill in skills:
        items.append(SkillResponse(
            id=skill.id,
            code=skill.code,
            name=skill.name,
            description=skill.description,
            domain=domain_brief,
            question_count=question_counts.get(skill.id, 0),
        ))

    return SkillListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/skills", response_model=SkillListResponse)
def list_skills(
    db: Session = Depends(get_db),
    domain_id: Optional[int] = Query(None, description="Filter by domain ID"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> SkillListResponse:
    """
    List all skills with optional domain filter.
    """
    query = db.query(Skill).filter(Skill.is_active == True)

    if domain_id:
        query = query.filter(Skill.domain_id == domain_id)

    total = query.count()
    skills = query.order_by(Skill.domain_id, Skill.display_order).offset(offset).limit(limit).all()

    # Get question counts per skill
    skill_ids = [s.id for s in skills]
    question_counts = dict(
        db.query(Question.skill_id, func.count(Question.id))
        .filter(
            Question.skill_id.in_(skill_ids),
            Question.is_active == True,
            Question.deleted_at == None,
        )
        .group_by(Question.skill_id)
        .all()
    ) if skill_ids else {}

    # Get domains for skills
    domain_ids = list(set(s.domain_id for s in skills if s.domain_id))
    domains = {
        d.id: DomainBrief(id=d.id, code=d.code, name=d.name)
        for d in db.query(Domain).filter(Domain.id.in_(domain_ids)).all()
    } if domain_ids else {}

    items = []
    for skill in skills:
        items.append(SkillResponse(
            id=skill.id,
            code=skill.code,
            name=skill.name,
            description=skill.description,
            domain=domains.get(skill.domain_id) if skill.domain_id else None,
            question_count=question_counts.get(skill.id, 0),
        ))

    return SkillListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/skills/{skill_id}", response_model=SkillResponse)
def get_skill(
    skill_id: int,
    db: Session = Depends(get_db),
) -> SkillResponse:
    """
    Get a single skill by ID with question count.
    """
    skill = db.query(Skill).filter(
        Skill.id == skill_id,
        Skill.is_active == True,
    ).first()

    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill not found",
        )

    question_count = db.query(func.count(Question.id)).filter(
        Question.skill_id == skill_id,
        Question.is_active == True,
        Question.deleted_at == None,
    ).scalar()

    domain_brief = None
    if skill.domain_id:
        domain = db.query(Domain).filter(Domain.id == skill.domain_id).first()
        if domain:
            domain_brief = DomainBrief(id=domain.id, code=domain.code, name=domain.name)

    return SkillResponse(
        id=skill.id,
        code=skill.code,
        name=skill.name,
        description=skill.description,
        domain=domain_brief,
        question_count=question_count or 0,
    )
