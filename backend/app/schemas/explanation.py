"""
SAT Tutoring Platform - Explanation Schemas

Pydantic schemas for step-by-step question explanations.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class DesmosConfig(BaseModel):
    equations: List[str]
    x_min: float = -10
    x_max: float = 10
    y_min: float = -10
    y_max: float = 10
    hint: Optional[str] = None


class HighlightItem(BaseModel):
    text: str
    color: Literal["yellow", "blue", "green", "red"]
    location: Literal["passage", "question", "choice_a", "choice_b", "choice_c", "choice_d"]


class ExplanationStep(BaseModel):
    title: str
    content: str
    highlights: Optional[List[HighlightItem]] = None
    desmos: Optional[DesmosConfig] = None


class StepByStepExplanation(BaseModel):
    type: Literal["math", "reading", "grammar"]
    steps: List[ExplanationStep]
    key_insight: str
    why_wrong: List[Dict[str, Any]] = []


class ExplanationResponse(BaseModel):
    question_id: UUID
    explanation_type: str
    data: StepByStepExplanation
    model_used: str
    is_approved: bool

    model_config = {"from_attributes": True, "protected_namespaces": ()}
