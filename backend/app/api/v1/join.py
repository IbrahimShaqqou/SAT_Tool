"""
Roster join links.

A lightweight, intake-free way for a tutor to add students: each tutor has a
stable join code (stored in their profile_data, so no schema migration). A
student opens /join/<code>, signs up or logs in, and is attached to that tutor.

Endpoints:
- GET  /tutor/join-link            (tutor)  -> the tutor's code + full URL, created on first use
- GET  /join/{code}                (public) -> the owning tutor's display name, for the join page
- POST /join/{code}                (student) -> attach the current student to that tutor
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.enums import UserRole
from app.api.deps import get_current_user, get_current_tutor

router = APIRouter()

JOIN_CODE_KEY = "join_code"  # key inside User.profile_data


# ----------------------------- schemas ----------------------------- #
class JoinLinkResponse(BaseModel):
    code: str
    link: str            # absolute URL to share (e.g. https://zooprep.com/join/abc123)
    path: str            # relative path (e.g. /join/abc123)


class JoinInfoResponse(BaseModel):
    code: str
    tutor_name: str


class JoinResultResponse(BaseModel):
    attached: bool
    tutor_id: str
    tutor_name: str
    already_member: bool


# ----------------------------- helpers ----------------------------- #
def _generate_join_code() -> str:
    """Short, URL-safe, unguessable code."""
    return secrets.token_urlsafe(9)  # ~12 chars


def _get_or_create_join_code(tutor: User, db: Session) -> str:
    data = dict(tutor.profile_data or {})
    code = data.get(JOIN_CODE_KEY)
    if not code:
        code = _generate_join_code()
        data[JOIN_CODE_KEY] = code
        tutor.profile_data = data  # reassign so SQLAlchemy flags the JSONB dirty
        db.add(tutor)
        db.commit()
        db.refresh(tutor)
    return code


def _tutor_by_code(code: str, db: Session) -> User:
    """Find the tutor whose profile_data.join_code matches. 404 if none."""
    tutor = (
        db.query(User)
        .filter(
            User.role == UserRole.TUTOR,
            User.is_active == True,  # noqa: E712
            User.profile_data[JOIN_CODE_KEY].astext == code,
        )
        .first()
    )
    if tutor is None:
        raise HTTPException(status_code=404, detail="This join link is invalid or no longer active.")
    return tutor


def _full_link(code: str) -> str:
    base = (settings.frontend_url or "").rstrip("/")
    return f"{base}/join/{code}"


# ----------------------------- routes ----------------------------- #
@router.get("/tutor/join-link", response_model=JoinLinkResponse, tags=["Tutor Dashboard"])
def get_join_link(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_tutor),
) -> JoinLinkResponse:
    """The tutor's reusable roster join link (created on first request)."""
    code = _get_or_create_join_code(current_user, db)
    return JoinLinkResponse(code=code, link=_full_link(code), path=f"/join/{code}")


@router.get("/join/{code}", response_model=JoinInfoResponse, tags=["Roster Join"])
def get_join_info(code: str, db: Session = Depends(get_db)) -> JoinInfoResponse:
    """Public: who does this link belong to? Lets the join page show the tutor's name."""
    tutor = _tutor_by_code(code, db)
    name = f"{tutor.first_name} {tutor.last_name}".strip() or "your tutor"
    return JoinInfoResponse(code=code, tutor_name=name)


@router.post("/join/{code}", response_model=JoinResultResponse, tags=["Roster Join"])
def join_tutor(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinResultResponse:
    """Attach the signed-in student to the tutor who owns this code."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only student accounts can join a tutor's roster.",
        )

    tutor = _tutor_by_code(code, db)
    if tutor.id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't join your own link.")

    tutor_name = f"{tutor.first_name} {tutor.last_name}".strip() or "your tutor"
    already = current_user.tutor_id == tutor.id

    current_user.tutor_id = tutor.id
    db.add(current_user)
    db.commit()

    return JoinResultResponse(
        attached=True,
        tutor_id=str(tutor.id),
        tutor_name=tutor_name,
        already_member=already,
    )
