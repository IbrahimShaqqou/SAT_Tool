"""
SAT Tutoring Platform - Tutor Dashboard API Tests

Tests for tutor student management and analytics.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession
from app.models.response import StudentResponse, StudentSkill
from app.models.user import User
from app.models.enums import (
    AnswerType, DifficultyLevel, SubjectArea, TestType, TestStatus, UserRole
)
from app.core.security import get_password_hash


@pytest.fixture
def student_with_tutor(db: Session, test_tutor: User) -> User:
    """Create a student assigned to the test tutor."""
    user = User(
        id=uuid4(),
        email="assigned_student@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Assigned",
        last_name="Student",
        role=UserRole.STUDENT,
        tutor_id=test_tutor.id,
        is_active=True,
        is_verified=True,
        profile_data={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def unassigned_student(db: Session) -> User:
    """Create a student without a tutor."""
    user = User(
        id=uuid4(),
        email="unassigned@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Unassigned",
        last_name="Student",
        role=UserRole.STUDENT,
        tutor_id=None,
        is_active=True,
        is_verified=True,
        profile_data={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


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
        name="Linear equations",
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
        external_id="tutor-q-001",
        subject_area=SubjectArea.MATH,
        domain_id=math_domain.id,
        skill_id=math_skill.id,
        answer_type=AnswerType.MCQ,
        difficulty=DifficultyLevel.MEDIUM,
        prompt_html="<p>What is x + 1 = 3?</p>",
        choices_json=["<p>1</p>", "<p>2</p>", "<p>3</p>", "<p>4</p>"],
        correct_answer_json={"index": 1},
        explanation_html="<p>x = 2</p>",
        is_active=True,
        is_verified=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@pytest.fixture
def student_responses(
    db: Session,
    student_with_tutor: User,
    sample_question: Question,
    math_skill: Skill,
) -> list[StudentResponse]:
    """Create sample responses for the student."""
    responses = []
    for i in range(5):
        response = StudentResponse(
            student_id=student_with_tutor.id,
            question_id=sample_question.id,
            response_json={"index": 1 if i < 3 else 0},
            is_correct=(i < 3),  # 3 correct, 2 incorrect
            time_spent_seconds=30,
            submitted_at=datetime.now(timezone.utc),
        )
        db.add(response)
        responses.append(response)

    # Create StudentSkill record
    skill_record = StudentSkill(
        student_id=student_with_tutor.id,
        skill_id=math_skill.id,
        mastery_level=60.0,
        questions_attempted=5,
        questions_correct=3,
        last_practiced_at=datetime.now(timezone.utc),
    )
    db.add(skill_record)

    db.commit()
    return responses


class TestListStudents:
    """Tests for listing tutor's students."""

    def test_list_students_empty(
        self,
        client: TestClient,
        tutor_headers: dict,
    ):
        """Test listing students when none assigned."""
        response = client.get("/api/v1/tutor/students", headers=tutor_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_students_with_data(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
    ):
        """Test listing assigned students."""
        response = client.get("/api/v1/tutor/students", headers=tutor_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["email"] == "assigned_student@test.com"

    def test_list_students_requires_tutor(
        self,
        client: TestClient,
        auth_headers: dict,
    ):
        """Test that students cannot access tutor endpoints."""
        response = client.get("/api/v1/tutor/students", headers=auth_headers)
        assert response.status_code == 403


class TestAddStudent:
    """Tests for adding students to roster."""

    def test_add_student_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        unassigned_student: User,
    ):
        """Test adding an unassigned student."""
        response = client.post(
            "/api/v1/tutor/students",
            json={"student_email": unassigned_student.email},
            headers=tutor_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == unassigned_student.email

    def test_add_student_not_found(
        self,
        client: TestClient,
        tutor_headers: dict,
    ):
        """Test adding non-existent student."""
        response = client.post(
            "/api/v1/tutor/students",
            json={"student_email": "nobody@test.com"},
            headers=tutor_headers,
        )
        assert response.status_code == 404

    def test_add_student_already_assigned(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
    ):
        """Test adding a student already in roster."""
        response = client.post(
            "/api/v1/tutor/students",
            json={"student_email": student_with_tutor.email},
            headers=tutor_headers,
        )
        assert response.status_code == 400
        assert "already in your roster" in response.json()["detail"]


class TestRemoveStudent:
    """Tests for removing students from roster."""

    def test_remove_student_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
    ):
        """Test removing a student from roster."""
        response = client.delete(
            f"/api/v1/tutor/students/{student_with_tutor.id}",
            headers=tutor_headers,
        )
        assert response.status_code == 204

    def test_remove_student_not_in_roster(
        self,
        client: TestClient,
        tutor_headers: dict,
        unassigned_student: User,
    ):
        """Test removing a student not in roster."""
        response = client.delete(
            f"/api/v1/tutor/students/{unassigned_student.id}",
            headers=tutor_headers,
        )
        assert response.status_code == 404


class TestGetStudentProfile:
    """Tests for getting student profile."""

    def test_get_profile_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
    ):
        """Test getting student profile."""
        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == student_with_tutor.email
        assert data["first_name"] == "Assigned"

    def test_get_profile_not_in_roster(
        self,
        client: TestClient,
        tutor_headers: dict,
        unassigned_student: User,
    ):
        """Test getting profile of student not in roster."""
        response = client.get(
            f"/api/v1/tutor/students/{unassigned_student.id}",
            headers=tutor_headers,
        )
        assert response.status_code == 404


class TestGetStudentProgress:
    """Tests for getting student progress."""

    def test_get_progress_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
        student_responses: list[StudentResponse],
    ):
        """Test getting complete student progress."""
        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}/progress",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == str(student_with_tutor.id)
        assert data["total_questions_answered"] == 5
        assert data["overall_accuracy"] == 60.0
        assert len(data["skills"]) >= 0


class TestGetStudentSessions:
    """Tests for getting student sessions."""

    def test_get_sessions_empty(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
    ):
        """Test getting sessions when none exist."""
        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}/sessions",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    def test_get_sessions_with_data(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
        db: Session,
    ):
        """Test getting sessions with data."""
        # Create a session
        session = TestSession(
            student_id=student_with_tutor.id,
            test_type=TestType.PRACTICE,
            status=TestStatus.COMPLETED,
            subject_area=SubjectArea.MATH,
            total_questions=5,
            questions_answered=5,
            questions_correct=3,
            score_percentage=60.0,
        )
        db.add(session)
        db.commit()

        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}/sessions",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1


class TestGetStudentResponses:
    """Tests for getting student response history."""

    def test_get_responses_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
        student_responses: list[StudentResponse],
    ):
        """Test getting response history."""
        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}/responses",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5

    def test_get_responses_filter_correct(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
        student_responses: list[StudentResponse],
    ):
        """Test filtering responses by correctness."""
        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}/responses?is_correct=true",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3


class TestGetStudentWeaknesses:
    """Tests for getting student weaknesses."""

    def test_get_weaknesses_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
        student_responses: list[StudentResponse],
    ):
        """Test getting student weaknesses."""
        response = client.get(
            f"/api/v1/tutor/students/{student_with_tutor.id}/weaknesses",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # 60% accuracy is below 70% threshold
        assert len(data["weak_skills"]) == 1
        assert data["weak_skills"][0]["accuracy"] == 60.0


class TestTutorAnalytics:
    """Tests for tutor analytics."""

    def test_get_analytics_empty(
        self,
        client: TestClient,
        tutor_headers: dict,
    ):
        """Test analytics when no students."""
        response = client.get("/api/v1/tutor/analytics", headers=tutor_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_students"] == 0

    def test_get_analytics_with_data(
        self,
        client: TestClient,
        tutor_headers: dict,
        student_with_tutor: User,
        student_responses: list[StudentResponse],
    ):
        """Test analytics with student data."""
        response = client.get("/api/v1/tutor/analytics", headers=tutor_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_students"] == 1
        assert data["active_students_this_week"] == 1
