"""
SAT Tutoring Platform - Token Schemas

Pydantic schemas for JWT token requests and responses.
"""

from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    """Schema for token response after login."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Schema for decoded JWT token payload."""
    sub: str  # User ID
    exp: int  # Expiration timestamp
    type: str  # "access" or "refresh"


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str
