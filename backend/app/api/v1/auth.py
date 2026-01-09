"""
SAT Tutoring Platform - Authentication API

Endpoints for user registration, login, and token management.
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
    create_password_reset_token,
    decode_password_reset_token,
)
from app.core.rate_limit import limiter
from app.config import settings
from app.models.user import User
from app.schemas import (
    Token,
    RefreshTokenRequest,
    UserCreate,
    UserResponse,
    UserUpdate,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    PasswordResetResponse,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")  # 5 registrations per minute per IP
def register(
    request: Request,
    user_in: UserCreate,
    db: Session = Depends(get_db),
) -> User:
    """
    Register a new user account.

    Args:
        user_in: User registration data

    Returns:
        The created user

    Raises:
        HTTPException 409: If email is already registered
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create new user
    user = User(
        id=uuid4(),
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        role=user_in.role,
        is_active=True,
        is_verified=False,
        profile_data={},
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")  # 10 login attempts per minute per IP
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict:
    """
    Authenticate user and return JWT tokens.

    Uses OAuth2 password flow (form data with username/password fields).
    The username field should contain the user's email.

    Args:
        form_data: OAuth2 form with username (email) and password

    Returns:
        Access and refresh tokens

    Raises:
        HTTPException 401: If credentials are invalid
    """
    # Find user by email (username field contains email)
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Create tokens
    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
@limiter.limit("30/minute")  # 30 refresh requests per minute per IP
def refresh_token(
    request: Request,
    token_request: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> dict:
    """
    Refresh access token using a valid refresh token.

    Args:
        token_request: Request containing the refresh token

    Returns:
        New access and refresh tokens

    Raises:
        HTTPException 401: If refresh token is invalid or expired
    """
    # Decode refresh token
    payload = decode_refresh_token(token_request.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user from token
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create new tokens
    access_token = create_access_token(subject=str(user.id))
    new_refresh_token = create_refresh_token(subject=str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get the current authenticated user's profile.

    Args:
        current_user: The authenticated user (from token)

    Returns:
        The user's profile data
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Update the current authenticated user's profile.

    Args:
        user_update: Fields to update
        current_user: The authenticated user (from token)

    Returns:
        The updated user profile
    """
    # Update provided fields
    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name
    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name
    if user_update.profile_data is not None:
        current_user.profile_data = user_update.profile_data

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/forgot-password", response_model=PasswordResetResponse)
@limiter.limit("3/minute")  # 3 reset requests per minute per IP
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    """
    Request a password reset email.

    Always returns success to prevent email enumeration attacks.
    In development mode, returns the reset URL directly.

    Args:
        body: Request containing user email

    Returns:
        Success message (and reset URL in development)
    """
    user = db.query(User).filter(User.email == body.email).first()

    response = {
        "message": "If an account with this email exists, a password reset link has been sent."
    }

    if user:
        # Generate reset token
        reset_token = create_password_reset_token(user.email)

        # In development, return the reset URL directly
        # In production, you would send an email instead
        if settings.debug or settings.environment == "development":
            # For local development
            reset_url = f"http://localhost:3000/reset-password?token={reset_token}"
            response["reset_url"] = reset_url
        else:
            # TODO: Implement email sending
            # For now, log the token (in production, send email)
            import logging
            logging.info(f"Password reset requested for {user.email}")
            # In production, you would send email here:
            # send_password_reset_email(user.email, reset_token)

    return response


@router.post("/reset-password", response_model=PasswordResetResponse)
@limiter.limit("5/minute")  # 5 reset attempts per minute per IP
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    """
    Reset password using a valid reset token.

    Args:
        body: Request containing reset token and new password

    Returns:
        Success message

    Raises:
        HTTPException 400: If token is invalid or expired
    """
    # Decode and validate token
    email = decode_password_reset_token(body.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Find user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Validate password strength (basic)
    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    # Update password
    user.password_hash = get_password_hash(body.new_password)
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in with your new password."}
