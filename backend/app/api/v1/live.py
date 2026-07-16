"""
Live tutoring session endpoints.

- POST /live/token: authenticated REST; authorizes the caller for a session and
  mints a short-lived single-use WS ticket.
- WS /live/ws/{session_id}: the live room connection (added in a later task).

The socket only mirrors state for observers; the student's answers continue to
flow through the existing practice/assignment/adaptive REST endpoints, so a
dropped socket never affects the student's test.
"""

import asyncio
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_tutor
from app.core.live_ticket import create_live_ticket, decode_live_ticket
from app.models.enums import UserRole
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.test import TestSession
from app.models.user import User
from app.schemas.live import LiveMessage, LiveTokenRequest, LiveTokenResponse
from app.services.live_room_manager import LiveRoomManager

router = APIRouter()

# Module-level singleton: the room registry lives for the process lifetime.
room_manager = LiveRoomManager()

# Server drops a connection with no message (incl. heartbeat) for this long.
# Clients heartbeat every ~20s, so this is ~2 missed heartbeats plus slack.
LIVE_IDLE_TIMEOUT = 45.0


def _authorize_session(session_id: UUID, user: User, db: Session):
    """
    Return (session, role) if the user may observe/participate in this session.
    Students may access their own sessions; tutors may access sessions owned by
    a student on their roster. Raises 403/404 otherwise.
    """
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if user.role == UserRole.STUDENT and session.student_id == user.id:
        return session, "student"

    if user.role in (UserRole.TUTOR, UserRole.ADMIN):
        owner = db.query(User).filter(User.id == session.student_id).first()
        if user.role == UserRole.ADMIN or (owner and owner.tutor_id == user.id):
            return session, "tutor"

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this session")


@router.post("/live/token", response_model=LiveTokenResponse, tags=["Live Session"])
def create_ticket(
    body: LiveTokenRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LiveTokenResponse:
    try:
        session_uuid = UUID(body.session_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    _, role = _authorize_session(session_uuid, user, db)
    ticket = create_live_ticket(user_id=str(user.id), session_id=body.session_id, role=role)
    return LiveTokenResponse(ticket=ticket, ws_path=f"/api/v1/live/ws/{body.session_id}")


class ActiveSessionItem(BaseModel):
    session_id: str
    student_id: str
    student_name: str
    test_type: str


class ActiveSessionsResponse(BaseModel):
    sessions: List[ActiveSessionItem]


@router.get("/live/active", response_model=ActiveSessionsResponse, tags=["Live Session"])
def list_active_sessions(
    db: Session = Depends(get_db),
    tutor: User = Depends(get_current_tutor),
) -> ActiveSessionsResponse:
    live_ids = room_manager.active_student_session_ids()
    if not live_ids:
        return ActiveSessionsResponse(sessions=[])

    rows = (
        db.query(TestSession, User)
        .join(User, User.id == TestSession.student_id)
        .filter(
            TestSession.id.in_([UUID(s) for s in live_ids]),
            User.tutor_id == tutor.id,
        )
        .all()
    )
    return ActiveSessionsResponse(
        sessions=[
            ActiveSessionItem(
                session_id=str(sess.id),
                student_id=str(user.id),
                student_name=user.full_name,
                test_type=str(sess.test_type.value if hasattr(sess.test_type, "value") else sess.test_type),
            )
            for sess, user in rows
        ]
    )


class LiveQuestionDetail(BaseModel):
    question_id: str
    prompt_html: Optional[str] = None
    choices: list = []
    answer_type: str
    correct_answer_json: Optional[Union[dict, list]] = None
    explanation_html: Optional[str] = None


@router.get("/live/question/{question_id}", response_model=LiveQuestionDetail, tags=["Live Session"])
def live_question_detail(
    question_id: UUID,
    db: Session = Depends(get_db),
    tutor: User = Depends(get_current_tutor),
) -> LiveQuestionDetail:
    """
    Return the answer + explanation + choices for a question so the tutor's live
    watch view can coach on whatever the student is currently on. Tutor-only.
    """
    q = db.query(Question).filter(Question.id == question_id).first()
    if q is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    # Source explanation the same way questions.py does: column, else raw_import rationale.
    explanation = q.explanation_html
    if not explanation and q.raw_import_json:
        explanation = q.raw_import_json.get("rationale_html")
    return LiveQuestionDetail(
        question_id=str(q.id),
        prompt_html=q.prompt_html,
        choices=q.choices_json or [],
        answer_type=q.answer_type.value if hasattr(q.answer_type, "value") else str(q.answer_type),
        correct_answer_json=q.correct_answer_json,
        explanation_html=explanation,
    )


def _build_snapshot(session_id: str, db: Session) -> dict:
    """
    Build a point-in-time snapshot of a session for a joining tutor.

    Returns the session's current question index plus the student's most recent
    response (question_id + answer) so a mid-session joiner sees current state.
    """
    session = db.query(TestSession).filter(TestSession.id == UUID(session_id)).first()
    if session is None:
        return {"question_index": None, "question_id": None, "selected_answer": None}
    latest = (
        db.query(StudentResponse)
        .filter(StudentResponse.test_session_id == session.id)
        .order_by(StudentResponse.submitted_at.desc())
        .first()
    )
    return {
        "question_index": session.current_question_index,
        "question_id": str(latest.question_id) if latest else None,
        "selected_answer": latest.response_json if latest else None,
    }


class _WSAdapter:
    """Adapts FastAPI WebSocket to the LiveConnection protocol."""

    def __init__(self, ws: WebSocket):
        self._ws = ws

    async def send_json(self, data: dict) -> None:
        await self._ws.send_json(data)


@router.websocket("/live/ws/{session_id}")
async def live_ws(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    ticket = websocket.query_params.get("ticket")
    claims = decode_live_ticket(ticket) if ticket else None
    role = claims.get("role") if claims else None

    # Validate ticket, path/session match, role, and single use BEFORE accepting.
    if (
        claims is None
        or claims.get("session_id") != session_id
        or role not in ("student", "tutor")
        or not room_manager.consume_ticket(claims.get("jti", ""))
    ):
        await websocket.close(code=4401)  # 4401: unauthorized (app-defined)
        return

    await websocket.accept()
    conn = _WSAdapter(websocket)
    await room_manager.join(session_id, role=role, conn=conn)

    # Send the joining tutor a snapshot of current state, then notify the student.
    if role == "tutor":
        snap = _build_snapshot(session_id, db)
        await conn.send_json({
            "type": "snapshot", "session_id": session_id,
            "sender_role": "server", "seq": 0, "payload": snap,
        })
        # Replay the room's cached student state (current question, latest answer)
        # so a mid-session joiner sees it immediately — no dependency on the
        # student reacting to tutor_joined (which was racy).
        await room_manager.replay_cache_to(session_id, conn)
        await room_manager.broadcast_to_student(
            session_id,
            {"type": "tutor_joined", "session_id": session_id,
             "sender_role": "server", "seq": 0, "payload": {}},
        )

    try:
        while True:
            # Liveness timeout: clients heartbeat every ~20s. If nothing arrives
            # for LIVE_IDLE_TIMEOUT (2 missed heartbeats + slack), treat the
            # connection as dead and tear the room down — otherwise an ungraceful
            # disconnect (tab crash, laptop sleep, network drop) would leave a
            # stale room and a phantom "Join" option for the tutor.
            try:
                raw = await asyncio.wait_for(websocket.receive_json(), timeout=LIVE_IDLE_TIMEOUT)
            except asyncio.TimeoutError:
                break
            try:
                msg = LiveMessage(**raw)
            except Exception:
                continue  # ignore malformed messages
            if msg.type == "heartbeat":
                continue
            # Bidirectional relay: student state mirrors to tutors; tutor actions
            # (shared drawing, etc.) broadcast to the student.
            if role == "student":
                dumped = msg.model_dump()
                room_manager.cache_student_message(session_id, dumped)
                await room_manager.relay_to_tutors(session_id, dumped)
            elif role == "tutor":
                await room_manager.broadcast_to_student(session_id, msg.model_dump())
    except WebSocketDisconnect:
        pass
    finally:
        await room_manager.leave(session_id, role=role, conn=conn)
        if role == "tutor":
            await room_manager.broadcast_to_student(
                session_id,
                {"type": "tutor_left", "session_id": session_id,
                 "sender_role": "server", "seq": 0, "payload": {}},
            )
