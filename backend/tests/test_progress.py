"""
SAT Tutoring Platform - Student Progress API Tests

Tests for student progress endpoints.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession
from app.models.response import StudentResponse
from app.models.user import User
from app.models.enums import (
    AnswerType, DifficultyLevel, SubjectArea, TestType, TestStatus
)


@pytest.fixture
def math_domain(db: Session) -> Domain:
    """Create a test math domain."""
    domain = Domain(
        code="H",
        name="Algebra",
        subject_area=SubjectArea.MATH,
        description="Heart of Algebra",
        display_order=1,
        is_active=True,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@pytest.fixture
def math_skill(db: Session, math_domain: Domain) -> Skill:
    """Create a test skill."""
    skill = Skill(
        domain_id=math_domain.id,
        code="H.A.",
        name="Linear equations in one variable",
        description="Solve linear equations",
        display_order=1,
        is_active=True,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@pytest.fixture
def sample_question(db: Session, math_domain: Domain, math_skill: Skill) -> Question:
    """Create a sample question."""
    question = Question(
        id=uuid4(),
        external_id="progress-q-001",
        subject_area=SubjectArea.MATH,
        domain_id=math_domain.id,
        skill_id=math_skill.id,
        answer_type=AnswerType.MCQ,
        difficulty=DifficultyLevel.MEDIUM,
        prompt_html="<p>What is 2 + 2?</p>",
        choices_json=["<p>3</p>", "<p>4</p>", "<p>5</p>", "<p>6</p>"],
        correct_answer_json={"index": 1},
        explanation_html="<p>2 + 2 = 4</p>",
        is_active=True,
        is_verified=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@pytest.fixture
def completed_session(db: Session, test_user: User) -> TestSession:
    """Create a completed test session."""
    session = TestSession(
        student_id=test_user.id,
        test_type=TestType.PRACTICE,
        status=TestStatus.COMPLETED,
        subject_area=SubjectArea.MATH,
        total_questions=5,
        questions_answered=5,
        questions_correct=4,
        score_percentage=80.0,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@pytest.fixture
def student_responses(
    db: Session,
    test_user: User,
    sample_question: Question,
    completed_session: TestSession,
) -> list[StudentResponse]:
    """Create sample student responses."""
    responses = []
    for i in range(5):
        response = StudentResponse(
            student_id=test_user.id,
            question_id=sample_question.id,
            test_session_id=completed_session.id,
            response_json={"index": 1 if i < 4 else 0},
            is_correct=(i < 4),  # 4 correct, 1 incorrect
            time_spent_seconds=30,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(response)
        responses.append(response)
    db.commit()
    for r in responses:
        db.refresh(r)
    return responses


class TestProgressSummary:
    """Tests for progress summary endpoint."""

    def test_get_summary_no_data(self, client: TestClient, auth_headers: dict):
        """Test getting summary when no responses exist."""
        response = client.get("/api/v1/progress/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_questions_answered"] == 0
        assert data["total_correct"] == 0
        assert data["overall_accuracy"] == 0.0
        assert data["sessions_completed"] == 0
        assert data["last_practice_at"] is None

    def test_get_summary_with_data(
        self,
        client: TestClient,
        auth_headers: dict,
        student_responses: list[StudentResponse],
        completed_session: TestSession,
    ):
        """Test getting summary with response data."""
        response = client.get("/api/v1/progress/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_questions_answered"] == 5
        assert data["total_correct"] == 4
        assert data["overall_accuracy"] == 80.0
        assert data["sessions_completed"] == 1
        assert data["last_practice_at"] is not None

    def test_get_summary_unauthenticated(self, client: TestClient):
        """Test getting summary without authentication fails."""
        response = client.get("/api/v1/progress/summary")
        assert response.status_code == 401


class TestResponseHistory:
    """Tests for response history endpoint."""

    def test_get_history_empty(self, client: TestClient, auth_headers: dict):
        """Test getting history when no responses exist."""
        response = client.get("/api/v1/progress/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_get_history_with_data(
        self,
        client: TestClient,
        auth_headers: dict,
        student_responses: list[StudentResponse],
    ):
        """Test getting history with response data."""
        response = client.get("/api/v1/progress/history", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 5
        # Check response structure
        item = data["items"][0]
        assert "id" in item
        assert "question_id" in item
        assert "is_correct" in item
        assert "submitted_at" in item

    def test_get_history_pagination(
        self,
        client: TestClient,
        auth_headers: dict,
        student_responses: list[StudentResponse],
    ):
        """Test history pagination."""
        response = client.get(
            "/api/v1/progress/history?limit=2&offset=0",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5
        assert data["limit"] == 2
        assert data["offset"] == 0

    def test_get_history_unauthenticated(self, client: TestClient):
        """Test getting history without authentication fails."""
        response = client.get("/api/v1/progress/history")
        assert response.status_code == 401
