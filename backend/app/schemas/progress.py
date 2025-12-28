"""
SAT Tutoring Platform - Student Progress Schemas

Pydantic schemas for student progress API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class ProgressSummary(BaseModel):
    """Overall student progress summary."""
    total_questions_answered: int
    total_correct: int
    overall_accuracy: float
    sessions_completed: int
    last_practice_at: Optional[datetime] = None


class ResponseHistoryItem(BaseModel):
    """Individual response in history."""
    id: UUID
    question_id: UUID
    is_correct: bool
    submitted_at: datetime


class ResponseHistoryResponse(BaseModel):
    """Paginated response history."""
    items: List[ResponseHistoryItem]
    total: int
    limit: int
    offset: int
