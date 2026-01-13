"""
ZooPrep - Lesson Schemas

Pydantic models for lesson API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# Content section types
class LessonSection(BaseModel):
    """A section within a lesson"""
    type: str = Field(..., description="Section type: text, example, tip, warning, image, code, formula")
    title: Optional[str] = Field(None, description="Section title")
    content: str = Field(..., description="Section content (HTML or markdown)")
    highlight_color: Optional[str] = Field(None, description="Highlight color for emphasis")
    image_url: Optional[str] = Field(None, description="Image URL if type is image")
    image_caption: Optional[str] = Field(None, description="Image caption")


class LessonExample(BaseModel):
    """An example problem within a lesson"""
    title: str = Field(..., description="Example title")
    problem: str = Field(..., description="Problem statement (HTML)")
    solution: str = Field(..., description="Solution explanation (HTML)")
    steps: Optional[List[str]] = Field(None, description="Step-by-step solution")
    tip: Optional[str] = Field(None, description="Helpful tip for this type of problem")


class LessonContent(BaseModel):
    """Structured lesson content"""
    introduction: Optional[str] = Field(None, description="Lesson introduction")
    sections: List[LessonSection] = Field(default_factory=list, description="Lesson sections")
    examples: List[LessonExample] = Field(default_factory=list, description="Worked examples")
    key_takeaways: List[str] = Field(default_factory=list, description="Key points to remember")
    common_mistakes: List[str] = Field(default_factory=list, description="Common mistakes to avoid")
    practice_tips: Optional[str] = Field(None, description="Tips for practicing this skill")


# API Response Schemas
class LessonListItem(BaseModel):
    """Lesson summary for list views"""
    id: UUID
    skill_id: int
    skill_name: str
    skill_code: str
    domain_id: Optional[int]
    domain_name: Optional[str]
    domain_code: Optional[str]
    title: str
    subtitle: Optional[str]
    status: str
    estimated_minutes: int
    difficulty_level: str
    icon: Optional[str]
    color: Optional[str]
    cover_image_url: Optional[str]
    display_order: int
    is_completed: bool = False
    completion_percent: int = 0

    class Config:
        from_attributes = True


class LessonDetail(BaseModel):
    """Full lesson detail"""
    id: UUID
    skill_id: int
    skill_name: str
    skill_code: str
    domain_id: Optional[int]
    domain_name: Optional[str]
    domain_code: Optional[str]
    title: str
    subtitle: Optional[str]
    status: str
    content: Optional[LessonContent]
    estimated_minutes: int
    difficulty_level: str
    icon: Optional[str]
    color: Optional[str]
    cover_image_url: Optional[str]
    is_completed: bool = False
    completion_percent: int = 0
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LessonsByDomain(BaseModel):
    """Lessons grouped by domain"""
    domain_id: int
    domain_code: str
    domain_name: str
    subject_area: str
    lessons: List[LessonListItem]
    total_lessons: int
    completed_lessons: int


class LessonsResponse(BaseModel):
    """Response for lessons list by subject"""
    subject_area: str
    domains: List[LessonsByDomain]
    total_lessons: int
    completed_lessons: int


# Request schemas
class LessonCreate(BaseModel):
    """Create a new lesson"""
    skill_id: int
    title: str
    subtitle: Optional[str] = None
    status: str = "draft"
    content: Optional[Dict[str, Any]] = None
    estimated_minutes: int = 10
    difficulty_level: str = "intermediate"
    icon: Optional[str] = None
    color: Optional[str] = None
    cover_image_url: Optional[str] = None
    display_order: int = 0


class LessonUpdate(BaseModel):
    """Update an existing lesson"""
    title: Optional[str] = None
    subtitle: Optional[str] = None
    status: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    estimated_minutes: Optional[int] = None
    difficulty_level: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    cover_image_url: Optional[str] = None
    display_order: Optional[int] = None


class LessonCompletionCreate(BaseModel):
    """Mark a lesson as completed"""
    time_spent_seconds: int = 0
    progress_percent: int = 100


class LessonCompletionResponse(BaseModel):
    """Completion status response"""
    lesson_id: UUID
    is_completed: bool
    progress_percent: int
    time_spent_seconds: int
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True
