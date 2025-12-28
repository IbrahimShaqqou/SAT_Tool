"""
SAT Tutoring Platform - Practice Sessions API Tests

Tests for practice session creation, answering, and completion.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession, TestQuestion
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
def sample_questions(db: Session, math_domain: Domain, math_skill: Skill) -> list[Question]:
    """Create sample questions for practice sessions."""
    questions = []
    for i in range(5):
        question = Question(
            id=uuid4(),
            external_id=f"practice-q-{i+1}",
            subject_area=SubjectArea.MATH,
            domain_id=math_domain.id,
            skill_id=math_skill.id,
            answer_type=AnswerType.MCQ,
            difficulty=DifficultyLevel.MEDIUM,
            prompt_html=f"<p>Question {i+1}: What is {i+1} + 1?</p>",
            choices_json=[f"<p>{i}</p>", f"<p>{i+1}</p>", f"<p>{i+2}</p>", f"<p>{i+3}</p>"],
            correct_answer_json={"index": 2},  # i+2 is correct
            explanation_html=f"<p>{i+1} + 1 = {i+2}</p>",
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
def spr_question(db: Session, math_domain: Domain, math_skill: Skill) -> Question:
    """Create a sample SPR question."""
    question = Question(
        id=uuid4(),
        external_id="practice-spr-1",
        subject_area=SubjectArea.MATH,
        domain_id=math_domain.id,
        skill_id=math_skill.id,
        answer_type=AnswerType.SPR,
        difficulty=DifficultyLevel.HARD,
        prompt_html="<p>What is 5 x 5?</p>",
        choices_json=None,
        correct_answer_json={"answers": ["25"]},
        explanation_html="<p>5 x 5 = 25</p>",
        is_active=True,
        is_verified=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


class TestCreatePracticeSession:
    """Tests for practice session creation."""

    def test_create_session_success(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test creating a practice session successfully."""
        response = client.post(
            "/api/v1/practice",
            json={
                "subject": "math",
                "question_count": 3,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "not_started"
        assert data["test_type"] == "practice"
        assert data["subject_area"] == "math"
        assert data["total_questions"] == 3
        assert data["questions_answered"] == 0

    def test_create_session_with_filters(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
        math_domain: Domain,
        math_skill: Skill,
    ):
        """Test creating a session with domain and skill filters."""
        response = client.post(
            "/api/v1/practice",
            json={
                "subject": "math",
                "question_count": 2,
                "domain_id": math_domain.id,
                "skill_id": math_skill.id,
                "difficulty": "M",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["total_questions"] == 2

    def test_create_session_unauthenticated(self, client: TestClient):
        """Test creating a session without authentication fails."""
        response = client.post(
            "/api/v1/practice",
            json={
                "subject": "math",
                "question_count": 5,
            },
        )
        assert response.status_code == 401

    def test_create_session_no_matching_questions(
        self, client: TestClient, auth_headers: dict
    ):
        """Test creating a session when no questions match filters."""
        response = client.post(
            "/api/v1/practice",
            json={
                "subject": "reading_writing",  # No reading questions exist
                "question_count": 5,
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "No questions match" in response.json()["detail"]

    def test_create_session_invalid_domain(
        self, client: TestClient, auth_headers: dict
    ):
        """Test creating a session with invalid domain ID."""
        response = client.post(
            "/api/v1/practice",
            json={
                "subject": "math",
                "question_count": 5,
                "domain_id": 9999,
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "Domain not found" in response.json()["detail"]


class TestListPracticeSessions:
    """Tests for listing practice sessions."""

    def test_list_sessions_empty(self, client: TestClient, auth_headers: dict):
        """Test listing sessions when none exist."""
        response = client.get("/api/v1/practice", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_sessions_with_data(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test listing sessions after creating some."""
        # Create two sessions
        client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 2},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )

        response = client.get("/api/v1/practice", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_sessions_filter_by_status(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test filtering sessions by status."""
        # Create and start a session
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 2},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Create another session (not started)
        client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 2},
            headers=auth_headers,
        )

        # Filter by in_progress
        response = client.get(
            "/api/v1/practice?status=in_progress",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "in_progress"


class TestGetPracticeSession:
    """Tests for getting a single practice session."""

    def test_get_session_not_started(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test getting a not-started session."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = client.get(f"/api/v1/practice/{session_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_started"
        assert data["current_question"] is None

    def test_get_session_in_progress(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test getting an in-progress session includes current question."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        # Start the session
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        response = client.get(f"/api/v1/practice/{session_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["current_question"] is not None
        assert data["current_question"]["order"] == 1
        assert "prompt_html" in data["current_question"]["question"]

    def test_get_session_not_found(self, client: TestClient, auth_headers: dict):
        """Test getting a non-existent session."""
        fake_id = uuid4()
        response = client.get(f"/api/v1/practice/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


class TestStartPracticeSession:
    """Tests for starting a practice session."""

    def test_start_session_success(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test starting a session successfully."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = client.post(
            f"/api/v1/practice/{session_id}/start",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["started_at"] is not None
        assert data["current_question_index"] == 0

    def test_start_already_started(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test starting an already started session fails."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        # Start once
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Try to start again
        response = client.post(
            f"/api/v1/practice/{session_id}/start",
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestSubmitAnswer:
    """Tests for submitting answers."""

    def test_submit_mcq_correct(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test submitting a correct MCQ answer."""
        # Create and start session
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Submit correct answer (index 2 is correct for our test questions)
        response = client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={
                "answer": {"index": 2},
                "time_spent_seconds": 30,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] == True
        assert data["correct_answer"]["index"] == 2
        assert data["next_question_index"] == 1

    def test_submit_mcq_incorrect(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test submitting an incorrect MCQ answer."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Submit wrong answer
        response = client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={
                "answer": {"index": 0},
                "time_spent_seconds": 20,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] == False
        assert data["explanation_html"] is not None

    def test_submit_spr_correct(
        self,
        client: TestClient,
        auth_headers: dict,
        spr_question: Question,
    ):
        """Test submitting a correct SPR answer."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 1},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        response = client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={
                "answer": {"answer": "25"},
                "time_spent_seconds": 40,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_correct"] == True
        assert data["session_complete"] == True

    def test_submit_answer_not_in_progress(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test submitting answer when session not started fails."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={"answer": {"index": 1}, "time_spent_seconds": 30},
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestPauseResumeSession:
    """Tests for pausing and resuming sessions."""

    def test_pause_session(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test pausing a session."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        response = client.post(
            f"/api/v1/practice/{session_id}/pause",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "paused"

    def test_resume_session(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test resuming a paused session."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)
        client.post(f"/api/v1/practice/{session_id}/pause", headers=auth_headers)

        response = client.post(
            f"/api/v1/practice/{session_id}/resume",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"

    def test_pause_not_in_progress(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test pausing a non-in-progress session fails."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]

        response = client.post(
            f"/api/v1/practice/{session_id}/pause",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_resume_not_paused(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test resuming a non-paused session fails."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        response = client.post(
            f"/api/v1/practice/{session_id}/resume",
            headers=auth_headers,
        )
        assert response.status_code == 400


class TestCompleteSession:
    """Tests for completing sessions."""

    def test_complete_session(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test completing a session with score calculation."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 2},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Answer first question correctly
        client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={"answer": {"index": 2}, "time_spent_seconds": 30},
            headers=auth_headers,
        )

        # Answer second question incorrectly
        client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={"answer": {"index": 0}, "time_spent_seconds": 20},
            headers=auth_headers,
        )

        # Complete session
        response = client.post(
            f"/api/v1/practice/{session_id}/complete",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["score_percentage"] == 50.0
        assert data["questions_correct"] == 1
        assert data["total_questions"] == 2

    def test_complete_early(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test completing a session early (before all questions answered)."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Answer only one question
        client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={"answer": {"index": 2}, "time_spent_seconds": 30},
            headers=auth_headers,
        )

        # Complete early
        response = client.post(
            f"/api/v1/practice/{session_id}/complete",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["questions_correct"] == 1
        assert data["total_questions"] == 3


class TestSessionResults:
    """Tests for getting session results."""

    def test_get_results_completed(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test getting results for a completed session."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 2},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        # Answer both questions
        client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={"answer": {"index": 2}, "time_spent_seconds": 30},
            headers=auth_headers,
        )
        client.post(
            f"/api/v1/practice/{session_id}/answer",
            json={"answer": {"index": 2}, "time_spent_seconds": 25},
            headers=auth_headers,
        )

        # Complete
        client.post(f"/api/v1/practice/{session_id}/complete", headers=auth_headers)

        # Get results
        response = client.get(
            f"/api/v1/practice/{session_id}/results",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["score_percentage"] == 100.0
        assert len(data["questions"]) == 2
        assert len(data["skill_breakdown"]) >= 1

        # Check question results
        q1 = data["questions"][0]
        assert q1["order"] == 1
        assert q1["is_correct"] == True
        assert q1["your_answer"]["index"] == 2
        assert q1["correct_answer"]["index"] == 2

    def test_get_results_not_completed(
        self,
        client: TestClient,
        auth_headers: dict,
        sample_questions: list[Question],
    ):
        """Test getting results for an incomplete session fails."""
        create_resp = client.post(
            "/api/v1/practice",
            json={"subject": "math", "question_count": 3},
            headers=auth_headers,
        )
        session_id = create_resp.json()["id"]
        client.post(f"/api/v1/practice/{session_id}/start", headers=auth_headers)

        response = client.get(
            f"/api/v1/practice/{session_id}/results",
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "completed" in response.json()["detail"].lower()
