"""
SAT Tutoring Platform - Health Check Tests

Tests for the health check endpoint.
"""

import pytest


def test_health_check(client):
    """Test the health check endpoint returns healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "sat-tutor-api"
    assert "version" in data


def test_root_endpoint(client):
    """Test the root endpoint returns API information."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data
    assert "health" in data
