"""
SAT Tutoring Platform - Questions API Tests

Tests for question listing, retrieval, and taxonomy endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from uuid import uuid4

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.enums import AnswerType, DifficultyLevel, SubjectArea


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
def reading_domain(db: Session) -> Domain:
    """Create a test reading domain."""
    domain = Domain(
        code="INI",
        name="Information and Ideas",
        subject_area=SubjectArea.READING_WRITING,
        description="Information and Ideas",
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
    """Create a sample MCQ question."""
    question = Question(
        id=uuid4(),
        external_id="test-question-001",
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
def sample_spr_question(db: Session, math_domain: Domain, math_skill: Skill) -> Question:
    """Create a sample SPR question."""
    question = Question(
        id=uuid4(),
        external_id="test-question-002",
        subject_area=SubjectArea.MATH,
        domain_id=math_domain.id,
        skill_id=math_skill.id,
        answer_type=AnswerType.SPR,
        difficulty=DifficultyLevel.HARD,
        prompt_html="<p>What is 3 x 3?</p>",
        choices_json=None,
        correct_answer_json={"answers": ["9"]},
        explanation_html="<p>3 x 3 = 9</p>",
        is_active=True,
        is_verified=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


class TestListQuestions:
    """Tests for question listing endpoint."""

    def test_list_questions_empty(self, client: TestClient):
        """Test listing questions when none exist."""
        response = client.get("/api/v1/questions")
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_questions_with_data(self, client: TestClient, sample_question: Question):
        """Test listing questions returns data."""
        response = client.get("/api/v1/questions")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["external_id"] == "test-question-001"

    def test_list_questions_filter_by_subject(
        self, client: TestClient, sample_question: Question
    ):
        """Test filtering questions by subject area."""
        response = client.get("/api/v1/questions?subject=math")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

        response = client.get("/api/v1/questions?subject=reading_writing")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    def test_list_questions_filter_by_difficulty(
        self, client: TestClient, sample_question: Question, sample_spr_question: Question
    ):
        """Test filtering questions by difficulty."""
        response = client.get("/api/v1/questions?difficulty=M")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["difficulty"] == "M"

        response = client.get("/api/v1/questions?difficulty=H")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["difficulty"] == "H"

    def test_list_questions_filter_by_answer_type(
        self, client: TestClient, sample_question: Question, sample_spr_question: Question
    ):
        """Test filtering questions by answer type."""
        response = client.get("/api/v1/questions?answer_type=MCQ")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["answer_type"] == "MCQ"

        response = client.get("/api/v1/questions?answer_type=SPR")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["answer_type"] == "SPR"

    def test_list_questions_pagination(
        self, client: TestClient, sample_question: Question, sample_spr_question: Question
    ):
        """Test question pagination."""
        response = client.get("/api/v1/questions?limit=1&offset=0")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["total"] == 2

        response = client.get("/api/v1/questions?limit=1&offset=1")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1


class TestGetQuestion:
    """Tests for single question retrieval."""

    def test_get_question_success(self, client: TestClient, sample_question: Question):
        """Test getting a single question by ID."""
        response = client.get(f"/api/v1/questions/{sample_question.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(sample_question.id)
        assert data["external_id"] == "test-question-001"
        assert data["prompt_html"] == "<p>What is 2 + 2?</p>"
        assert len(data["choices"]) == 4
        assert data["correct_answer"] == {"index": 1}
        assert data["explanation_html"] == "<p>2 + 2 = 4</p>"

    def test_get_question_not_found(self, client: TestClient):
        """Test getting a non-existent question."""
        fake_id = uuid4()
        response = client.get(f"/api/v1/questions/{fake_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_spr_question(self, client: TestClient, sample_spr_question: Question):
        """Test getting an SPR question (no choices)."""
        response = client.get(f"/api/v1/questions/{sample_spr_question.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["answer_type"] == "SPR"
        assert data["choices"] is None
        assert data["correct_answer"] == {"answers": ["9"]}


class TestRandomQuestions:
    """Tests for random question endpoint."""

    def test_random_question_single(self, client: TestClient, sample_question: Question):
        """Test getting a single random question."""
        response = client.get("/api/v1/questions/random")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["id"] == str(sample_question.id)

    def test_random_question_multiple(
        self, client: TestClient, sample_question: Question, sample_spr_question: Question
    ):
        """Test getting multiple random questions."""
        response = client.get("/api/v1/questions/random?count=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2

    def test_random_question_with_filter(
        self, client: TestClient, sample_question: Question, sample_spr_question: Question
    ):
        """Test random questions with filters."""
        response = client.get("/api/v1/questions/random?difficulty=M")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["difficulty"] == "M"


class TestDomains:
    """Tests for domain endpoints."""

    def test_list_domains(self, client: TestClient, math_domain: Domain, reading_domain: Domain):
        """Test listing all domains."""
        response = client.get("/api/v1/domains")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2

    def test_list_domains_with_question_count(
        self, client: TestClient, math_domain: Domain, sample_question: Question
    ):
        """Test domains include question counts."""
        response = client.get("/api/v1/domains")
        assert response.status_code == 200
        data = response.json()
        math_item = next(d for d in data["items"] if d["code"] == "H")
        assert math_item["question_count"] == 1

    def test_get_domain(self, client: TestClient, math_domain: Domain):
        """Test getting a single domain."""
        response = client.get(f"/api/v1/domains/{math_domain.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "H"
        assert data["name"] == "Algebra"

    def test_get_domain_not_found(self, client: TestClient):
        """Test getting a non-existent domain."""
        response = client.get("/api/v1/domains/9999")
        assert response.status_code == 404


class TestSkills:
    """Tests for skill endpoints."""

    def test_list_skills(self, client: TestClient, math_skill: Skill):
        """Test listing all skills."""
        response = client.get("/api/v1/skills")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    def test_list_skills_by_domain(
        self, client: TestClient, math_domain: Domain, math_skill: Skill
    ):
        """Test listing skills filtered by domain."""
        response = client.get(f"/api/v1/domains/{math_domain.id}/skills")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["code"] == "H.A."

    def test_get_skill(self, client: TestClient, math_skill: Skill):
        """Test getting a single skill."""
        response = client.get(f"/api/v1/skills/{math_skill.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "H.A."
        assert data["name"] == "Linear equations in one variable"

    def test_get_skill_with_question_count(
        self, client: TestClient, math_skill: Skill, sample_question: Question
    ):
        """Test skill includes question count."""
        response = client.get(f"/api/v1/skills/{math_skill.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["question_count"] == 1

    def test_get_skill_not_found(self, client: TestClient):
        """Test getting a non-existent skill."""
        response = client.get("/api/v1/skills/9999")
        assert response.status_code == 404
