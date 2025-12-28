"""
SAT Tutoring Platform - Taxonomy Schemas

Pydantic schemas for domain/skill taxonomy API responses.
"""

from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import SubjectArea


class DomainBrief(BaseModel):
    """Brief domain info for nested responses."""
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class DomainResponse(BaseModel):
    """Domain with question count."""
    id: int
    code: str
    name: str
    subject_area: SubjectArea
    description: Optional[str] = None
    question_count: int = 0

    model_config = {"from_attributes": True}


class DomainListResponse(BaseModel):
    """List of domains."""
    items: List[DomainResponse]


class SkillResponse(BaseModel):
    """Skill with domain info and question count."""
    id: int
    code: str
    name: str
    description: Optional[str] = None
    domain: Optional[DomainBrief] = None
    question_count: int = 0

    model_config = {"from_attributes": True}


class SkillListResponse(BaseModel):
    """Paginated list of skills."""
    items: List[SkillResponse]
    total: int
    limit: int
    offset: int
