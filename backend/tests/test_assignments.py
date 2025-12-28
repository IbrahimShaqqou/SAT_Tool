"""
SAT Tutoring Platform - Assignments API Tests

Tests for tutor-assigned practice sessions.
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.assignment import Assignment
from app.models.user import User
from app.models.enums import (
    AnswerType, DifficultyLevel, SubjectArea, AssignmentStatus, UserRole
)
from app.core.security import get_password_hash


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
def sample_questions(db: Session, math_domain: Domain, math_skill: Skill) -> list[Question]:
    """Create sample questions."""
    questions = []
    for i in range(5):
        question = Question(
            id=uuid4(),
            external_id=f"assign-q-{i+1}",
            subject_area=SubjectArea.MATH,
            domain_id=math_domain.id,
            skill_id=math_skill.id,
            answer_type=AnswerType.MCQ,
            difficulty=DifficultyLevel.MEDIUM,
            prompt_html=f"<p>Question {i+1}?</p>",
            choices_json=["<p>A</p>", "<p>B</p>", "<p>C</p>", "<p>D</p>"],
            correct_answer_json={"index": 1},
            explanation_html=f"<p>Answer is B</p>",
            is_active=True,
            is_verified=True,
        )
        db.add(question)
        questions.append(question)
    db.commit()
    for q in questions:
        db.refresh(q)
    return questions


@pytest.fixture
def second_student(db: Session) -> User:
    """Create a second test student."""
    user = User(
        id=uuid4(),
        email="student2@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Jane",
        last_name="Student",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
        profile_data={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class TestCreateAssignment:
    """Tests for assignment creation."""

    def test_create_assignment_success(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test creating an assignment successfully."""
        response = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Algebra Practice",
                "instructions": "Complete all questions",
                "subject": "math",
                "question_count": 3,
            },
            headers=tutor_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Algebra Practice"
        assert data["status"] == "pending"
        assert data["total_questions"] == 3
        assert data["student_id"] == str(test_user.id)

    def test_create_assignment_with_filters(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
        math_domain: Domain,
    ):
        """Test creating assignment with domain filter."""
        response = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Domain Practice",
                "subject": "math",
                "question_count": 2,
                "domain_id": math_domain.id,
                "difficulty": "M",
            },
            headers=tutor_headers,
        )
        assert response.status_code == 201
        assert response.json()["total_questions"] == 2

    def test_create_assignment_student_not_found(
        self,
        client: TestClient,
        tutor_headers: dict,
        sample_questions: list[Question],
    ):
        """Test creating assignment for non-existent student."""
        response = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(uuid4()),
                "title": "Test",
                "subject": "math",
                "question_count": 3,
            },
            headers=tutor_headers,
        )
        assert response.status_code == 400
        assert "Student not found" in response.json()["detail"]

    def test_create_assignment_student_cannot_create(
        self,
        client: TestClient,
        auth_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test that students cannot create assignments."""
        response = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Test",
                "subject": "math",
                "question_count": 3,
            },
            headers=auth_headers,
        )
        assert response.status_code == 403


class TestListAssignments:
    """Tests for listing assignments."""

    def test_list_assignments_tutor(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test tutor listing their created assignments."""
        # Create an assignment
        client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Test Assignment",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )

        response = client.get("/api/v1/assignments", headers=tutor_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Test Assignment"

    def test_list_assignments_student(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test student listing their assigned assignments."""
        # Create an assignment for the student
        client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Student Assignment",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )

        response = client.get("/api/v1/assignments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Student Assignment"

    def test_list_assignments_filter_status(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test filtering assignments by status."""
        client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Test",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )

        response = client.get(
            "/api/v1/assignments?status=pending",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 1

        response = client.get(
            "/api/v1/assignments?status=completed",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0


class TestGetAssignment:
    """Tests for getting a single assignment."""

    def test_get_assignment_tutor(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test tutor getting assignment details."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Detail Test",
                "instructions": "Do your best",
                "subject": "math",
                "question_count": 3,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        response = client.get(
            f"/api/v1/assignments/{assignment_id}",
            headers=tutor_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Detail Test"
        assert data["instructions"] == "Do your best"
        assert data["total_questions"] == 3

    def test_get_assignment_not_found(
        self,
        client: TestClient,
        tutor_headers: dict,
    ):
        """Test getting non-existent assignment."""
        response = client.get(
            f"/api/v1/assignments/{uuid4()}",
            headers=tutor_headers,
        )
        assert response.status_code == 404


class TestUpdateAssignment:
    """Tests for updating assignments."""

    def test_update_assignment(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test tutor updating an assignment."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Original Title",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        response = client.patch(
            f"/api/v1/assignments/{assignment_id}",
            json={
                "title": "Updated Title",
                "instructions": "New instructions",
            },
            headers=tutor_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    def test_update_assignment_student_forbidden(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test student cannot update assignments."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Test",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        response = client.patch(
            f"/api/v1/assignments/{assignment_id}",
            json={"title": "Hacked"},
            headers=auth_headers,
        )
        assert response.status_code == 403


class TestDeleteAssignment:
    """Tests for deleting assignments."""

    def test_delete_pending_assignment(
        self,
        client: TestClient,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test deleting a pending assignment."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "To Delete",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        response = client.delete(
            f"/api/v1/assignments/{assignment_id}",
            headers=tutor_headers,
        )
        assert response.status_code == 204


class TestStartAssignment:
    """Tests for starting assignments."""

    def test_start_assignment(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test student starting an assignment."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Start Test",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        response = client.post(
            f"/api/v1/assignments/{assignment_id}/start",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["started_at"] is not None

    def test_start_assignment_already_started(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test starting an already started assignment fails."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Test",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        client.post(f"/api/v1/assignments/{assignment_id}/start", headers=auth_headers)
        response = client.post(
            f"/api/v1/assignments/{assignment_id}/start",
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestAnswerAssignment:
    """Tests for answering assignment questions."""

    def test_answer_correct(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test submitting a correct answer."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Answer Test",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        client.post(f"/api/v1/assignments/{assignment_id}/start", headers=auth_headers)

        response = client.post(
            f"/api/v1/assignments/{assignment_id}/answer",
            json={"answer": {"index": 1}, "time_spent_seconds": 30},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] == True
        assert data["next_question_index"] == 1

    def test_answer_last_question(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test answering the last question."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Last Q Test",
                "subject": "math",
                "question_count": 2,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        client.post(f"/api/v1/assignments/{assignment_id}/start", headers=auth_headers)
        client.post(
            f"/api/v1/assignments/{assignment_id}/answer",
            json={"answer": {"index": 1}, "time_spent_seconds": 30},
            headers=auth_headers,
        )

        response = client.post(
            f"/api/v1/assignments/{assignment_id}/answer",
            json={"answer": {"index": 1}, "time_spent_seconds": 25},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["assignment_complete"] == True


class TestSubmitAssignment:
    """Tests for submitting assignments."""

    def test_submit_assignment(
        self,
        client: TestClient,
        auth_headers: dict,
        tutor_headers: dict,
        test_user: User,
        sample_questions: list[Question],
    ):
        """Test submitting a completed assignment."""
        create_resp = client.post(
            "/api/v1/assignments",
            json={
                "student_id": str(test_user.id),
                "title": "Submit Test",
                "subject": "math",
                "question_count": 2,
                "target_score": 50,
            },
            headers=tutor_headers,
        )
        assignment_id = create_resp.json()["id"]

        client.post(f"/api/v1/assignments/{assignment_id}/start", headers=auth_headers)
        client.post(
            f"/api/v1/assignments/{assignment_id}/answer",
            json={"answer": {"index": 1}, "time_spent_seconds": 30},
            headers=auth_headers,
        )
        client.post(
            f"/api/v1/assignments/{assignment_id}/answer",
            json={"answer": {"index": 1}, "time_spent_seconds": 25},
            headers=auth_headers,
        )

        response = client.post(
            f"/api/v1/assignments/{assignment_id}/submit",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["score_percentage"] == 100.0
        assert data["questions_correct"] == 2
        assert data["passed"] == True
