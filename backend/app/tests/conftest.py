"""
SAT Tutoring Platform - Pytest Configuration

Shared fixtures and configuration for all tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db


# Use SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """
    Create a fresh database for each test.

    Yields:
        Session: SQLAlchemy database session
    """
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """
    Create a test client with database dependency override.

    Args:
        db: The test database session

    Yields:
        TestClient: FastAPI test client
    """

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_user_data():
    """
    Sample user data for testing.

    Returns:
        dict: User registration data
    """
    return {
        "email": "test@example.com",
        "password": "SecurePassword123!",
        "full_name": "Test User",
        "is_tutor": False,
    }


@pytest.fixture
def sample_question_data():
    """
    Sample question data for testing.

    Returns:
        dict: Question creation data
    """
    return {
        "external_id": "test-question-001",
        "domain": "Math",
        "subdomain": "Algebra",
        "skill": "Linear equations in one variable",
        "difficulty": 0.5,
        "discrimination": 1.0,
        "stimulus": "Solve for x: 2x + 5 = 13",
        "stem": "What is the value of x?",
        "choices": {
            "A": "3",
            "B": "4",
            "C": "5",
            "D": "6",
        },
        "correct_answer": "B",
        "rationale": "2x + 5 = 13 → 2x = 8 → x = 4",
    }
