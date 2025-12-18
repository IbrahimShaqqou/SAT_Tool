"""
SAT Tutoring Platform - API Dependencies

FastAPI dependencies for authentication, database sessions, etc.
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings

# OAuth2 scheme for JWT token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """
    Dependency to get the current authenticated user from JWT token.

    Args:
        db: Database session
        token: JWT token from Authorization header

    Returns:
        User: The authenticated user object

    Raises:
        HTTPException: If token is invalid or user not found
    """
    # TODO: Implement JWT token validation and user lookup
    # from app.core.security import decode_access_token
    # from app.models.user import User
    #
    # payload = decode_access_token(token)
    # if payload is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Could not validate credentials",
    #         headers={"WWW-Authenticate": "Bearer"},
    #     )
    # user = db.query(User).filter(User.id == payload.get("sub")).first()
    # if user is None:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="User not found",
    #     )
    # return user
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Authentication not yet implemented",
    )


async def get_current_tutor(current_user=Depends(get_current_user)):
    """
    Dependency to ensure current user is a tutor.

    Args:
        current_user: The authenticated user

    Returns:
        User: The authenticated tutor

    Raises:
        HTTPException: If user is not a tutor
    """
    # TODO: Implement tutor role check
    # if not current_user.is_tutor:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Tutor access required",
    #     )
    # return current_user
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Tutor authentication not yet implemented",
    )
