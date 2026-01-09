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


class ForgotPasswordRequest(BaseModel):
    """Schema for password reset request."""
    email: str


class ResetPasswordRequest(BaseModel):
    """Schema for setting new password."""
    token: str
    new_password: str


class PasswordResetResponse(BaseModel):
    """Schema for password reset response."""
    message: str
    reset_url: Optional[str] = None  # Only included in development mode
