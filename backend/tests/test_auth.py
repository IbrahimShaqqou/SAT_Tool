"""
SAT Tutoring Platform - Authentication Tests

Tests for user registration, login, token refresh, and protected endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User


class TestRegistration:
    """Tests for user registration endpoint."""

    def test_register_success(self, client: TestClient):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@test.com",
                "password": "SecurePass123",
                "first_name": "New",
                "last_name": "User",
                "role": "student",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@test.com"
        assert data["first_name"] == "New"
        assert data["last_name"] == "User"
        assert data["role"] == "student"
        assert data["is_active"] is True
        assert "id" in data
        assert "password" not in data
        assert "password_hash" not in data

    def test_register_duplicate_email(self, client: TestClient, test_user: User):
        """Test registration fails with duplicate email."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,
                "password": "SecurePass123",
                "first_name": "Duplicate",
                "last_name": "User",
            },
        )
        assert response.status_code == 409
        assert "already registered" in response.json()["detail"]

    def test_register_invalid_email(self, client: TestClient):
        """Test registration fails with invalid email format."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePass123",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 422

    def test_register_weak_password(self, client: TestClient):
        """Test registration fails with weak password."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@test.com",
                "password": "weak",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 422

    def test_register_password_no_digit(self, client: TestClient):
        """Test registration fails when password has no digit."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@test.com",
                "password": "NoDigitsHere",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 422

    def test_register_tutor(self, client: TestClient):
        """Test tutor registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "tutor@test.com",
                "password": "TutorPass123",
                "first_name": "New",
                "last_name": "Tutor",
                "role": "tutor",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "tutor"


class TestLogin:
    """Tests for user login endpoint."""

    def test_login_success(self, client: TestClient, test_user: User):
        """Test successful login returns tokens."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": test_user.email,
                "password": "TestPass123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient, test_user: User):
        """Test login fails with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": test_user.email,
                "password": "WrongPassword123",
            },
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    def test_login_nonexistent_user(self, client: TestClient):
        """Test login fails for non-existent user."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "nobody@test.com",
                "password": "TestPass123",
            },
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    def test_login_inactive_user(self, client: TestClient, db: Session, test_user: User):
        """Test login fails for inactive user."""
        test_user.is_active = False
        db.commit()

        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": test_user.email,
                "password": "TestPass123",
            },
        )
        assert response.status_code == 401
        assert "inactive" in response.json()["detail"]


class TestTokenRefresh:
    """Tests for token refresh endpoint."""

    def test_refresh_success(self, client: TestClient, test_user: User):
        """Test successful token refresh."""
        # First login to get refresh token
        login_response = client.post(
            "/api/v1/auth/login",
            data={
                "username": test_user.email,
                "password": "TestPass123",
            },
        )
        refresh_token = login_response.json()["refresh_token"]

        # Use refresh token to get new tokens
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_refresh_invalid_token(self, client: TestClient):
        """Test refresh fails with invalid token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"},
        )
        assert response.status_code == 401
        assert "Invalid or expired" in response.json()["detail"]

    def test_refresh_with_access_token(self, client: TestClient, user_token: str):
        """Test refresh fails when using access token instead of refresh token."""
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": user_token},
        )
        assert response.status_code == 401


class TestCurrentUser:
    """Tests for current user profile endpoint."""

    def test_get_current_user(self, client: TestClient, test_user: User, auth_headers: dict):
        """Test getting current user profile."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["first_name"] == test_user.first_name
        assert data["last_name"] == test_user.last_name
        assert data["role"] == test_user.role.value

    def test_get_current_user_no_token(self, client: TestClient):
        """Test getting current user fails without token."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_get_current_user_invalid_token(self, client: TestClient):
        """Test getting current user fails with invalid token."""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401

    def test_update_current_user(self, client: TestClient, test_user: User, auth_headers: dict):
        """Test updating current user profile."""
        response = client.patch(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={
                "first_name": "Updated",
                "last_name": "Name",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "Updated"
        assert data["last_name"] == "Name"

    def test_update_current_user_partial(self, client: TestClient, test_user: User, auth_headers: dict):
        """Test partial update of current user profile."""
        original_last_name = test_user.last_name
        response = client.patch(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"first_name": "OnlyFirst"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "OnlyFirst"
        assert data["last_name"] == original_last_name


class TestRoleBasedAccess:
    """Tests for role-based access control."""

    def test_tutor_has_tutor_role(self, client: TestClient, test_tutor: User, tutor_headers: dict):
        """Test tutor user has correct role."""
        response = client.get("/api/v1/auth/me", headers=tutor_headers)
        assert response.status_code == 200
        assert response.json()["role"] == "tutor"

    def test_admin_has_admin_role(self, client: TestClient, test_admin: User, admin_headers: dict):
        """Test admin user has correct role."""
        response = client.get("/api/v1/auth/me", headers=admin_headers)
        assert response.status_code == 200
        assert response.json()["role"] == "admin"
