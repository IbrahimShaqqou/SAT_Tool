"""
SAT Tutoring Platform - Test Configuration

Pytest fixtures for database, client, and authentication.
"""

import pytest
from typing import Generator
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import get_password_hash, create_access_token
from app.config import settings


# Use test PostgreSQL database
TEST_DATABASE_URL = settings.database_url.replace("/sat_tutor", "/sat_tutor_test")

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create test database tables once per test session."""
    # Import all models to ensure they're registered with Base
    from app.models import (  # noqa
        User, Domain, Subdomain, Skill,
        Question, QuestionVersion, QuestionRelation,
        StudentResponse, StudentSkill,
        TestSession, TestQuestion,
        Assignment, AssignmentQuestion,
    )

    # Drop and recreate all tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield

    # Clean up after all tests
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db(setup_test_database) -> Generator[Session, None, None]:
    """Create a fresh database session for each test with transaction rollback."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """Create a test client with overridden database dependency."""
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
def test_user(db: Session) -> User:
    """Create a test student user."""
    user = User(
        id=uuid4(),
        email="student@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Test",
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


@pytest.fixture
def test_tutor(db: Session) -> User:
    """Create a test tutor user."""
    user = User(
        id=uuid4(),
        email="tutor@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Test",
        last_name="Tutor",
        role=UserRole.TUTOR,
        is_active=True,
        is_verified=True,
        profile_data={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_admin(db: Session) -> User:
    """Create a test admin user."""
    user = User(
        id=uuid4(),
        email="admin@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Test",
        last_name="Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        profile_data={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_token(test_user: User) -> str:
    """Get access token for test user."""
    return create_access_token(subject=str(test_user.id))


@pytest.fixture
def tutor_token(test_tutor: User) -> str:
    """Get access token for test tutor."""
    return create_access_token(subject=str(test_tutor.id))


@pytest.fixture
def admin_token(test_admin: User) -> str:
    """Get access token for test admin."""
    return create_access_token(subject=str(test_admin.id))


@pytest.fixture
def auth_headers(user_token: str) -> dict:
    """Get authorization headers for test user."""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def tutor_headers(tutor_token: str) -> dict:
    """Get authorization headers for test tutor."""
    return {"Authorization": f"Bearer {tutor_token}"}


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Get authorization headers for test admin."""
    return {"Authorization": f"Bearer {admin_token}"}
