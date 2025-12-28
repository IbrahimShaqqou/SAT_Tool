"""
SAT Tutoring Platform - Question Schemas

Pydantic schemas for question-related API requests and responses.
"""

from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import AnswerType, DifficultyLevel, SubjectArea


class DomainBrief(BaseModel):
    """Brief domain info for nested responses."""
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class SkillBrief(BaseModel):
    """Brief skill info for nested responses."""
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class ChoiceOption(BaseModel):
    """MCQ choice option."""
    index: int
    content: str


class QuestionBrief(BaseModel):
    """Brief question info for list views (no explanation)."""
    id: UUID
    external_id: str
    subject_area: SubjectArea
    domain: Optional[DomainBrief] = None
    skill: Optional[SkillBrief] = None
    difficulty: Optional[DifficultyLevel] = None
    answer_type: AnswerType
    prompt_html: str

    model_config = {"from_attributes": True}


class QuestionDetail(BaseModel):
    """Full question details including explanation."""
    id: UUID
    external_id: str
    subject_area: SubjectArea
    domain: Optional[DomainBrief] = None
    skill: Optional[SkillBrief] = None
    difficulty: Optional[DifficultyLevel] = None
    answer_type: AnswerType
    prompt_html: str
    choices: Optional[List[ChoiceOption]] = None
    correct_answer: Optional[dict] = None
    explanation_html: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_choices(cls, question) -> "QuestionDetail":
        """Create from ORM object, transforming choices_json to choices list."""
        choices = None
        if question.choices_json:
            choices = [
                ChoiceOption(index=i, content=c)
                for i, c in enumerate(question.choices_json)
            ]

        return cls(
            id=question.id,
            external_id=question.external_id,
            subject_area=question.subject_area,
            domain=DomainBrief.model_validate(question.domain) if question.domain else None,
            skill=SkillBrief.model_validate(question.skill) if question.skill else None,
            difficulty=question.difficulty,
            answer_type=question.answer_type,
            prompt_html=question.prompt_html,
            choices=choices,
            correct_answer=question.correct_answer_json,
            explanation_html=question.explanation_html,
        )


class QuestionListResponse(BaseModel):
    """Paginated list of questions."""
    items: List[QuestionBrief]
    total: int
    limit: int
    offset: int


class QuestionRandomResponse(BaseModel):
    """Response for random question(s) endpoint."""
    items: List[QuestionDetail]
