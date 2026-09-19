from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_db, get_current_user
from app.models.session_replay import SessionReplay
from app.models.user import User

router = APIRouter()


class EventBatch(BaseModel):
    session_id: str
    page_url: str
    user_agent: Optional[str] = None
    events: List[Any]
    duration_ms: int = 0


class ReplaySummary(BaseModel):
    session_id: str
    page_url: str
    user_agent: Optional[str]
    duration_ms: int
    event_count: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.post("/replays/events", status_code=204)
def ingest_events(batch: EventBatch, db: Session = Depends(get_db)):
    """Append a batch of rrweb events to a session. Creates the session if new."""
    replay = db.query(SessionReplay).filter(
        SessionReplay.session_id == batch.session_id
    ).first()

    if replay is None:
        replay = SessionReplay(
            session_id=batch.session_id,
            page_url=batch.page_url,
            user_agent=batch.user_agent,
            events=batch.events,
            duration_ms=batch.duration_ms,
        )
        db.add(replay)
    else:
        replay.events = (replay.events or []) + batch.events
        replay.duration_ms = max(replay.duration_ms, batch.duration_ms)

    db.commit()


@router.get("/replays/", response_model=List[ReplaySummary])
def list_replays(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all recorded sessions. Tutor/admin only."""
    if current_user.email != "ibrahimshaqqou@gmail.com":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    rows = db.query(SessionReplay).order_by(SessionReplay.created_at.desc()).all()
    return [
        ReplaySummary(
            session_id=r.session_id,
            page_url=r.page_url,
            user_agent=r.user_agent,
            duration_ms=r.duration_ms,
            event_count=len(r.events or []),
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        )
        for r in rows
    ]


@router.get("/replays/{session_id}/events")
def get_replay_events(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all rrweb events for a session. Tutor/admin only."""
    if current_user.email != "ibrahimshaqqou@gmail.com":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    replay = db.query(SessionReplay).filter(
        SessionReplay.session_id == session_id
    ).first()
    if replay is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session_id": session_id, "events": replay.events or []}
