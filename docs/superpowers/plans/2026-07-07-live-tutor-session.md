# Live Tutor Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tutor watch a student's in-progress session in real time (which question, their answer, their drawing) with a collapsible coaching sidebar showing the correct answer and explanation, and show the student a clear "tutor joined" indicator.

**Architecture:** A single WebSocket "live room" per `TestSession`, relayed in-memory by a `LiveRoomManager` on the FastAPI backend (single Railway instance; interface allows a later Redis swap). WS auth uses a short-lived single-use ticket minted by a JWT-authenticated REST endpoint. The socket only *mirrors* state to the tutor — answers still flow through existing REST endpoints, so a dropped socket never affects the student's test. Phase 1 is observe-only (student → tutor is read-only); the envelope and room model are built to absorb Phase 2's bidirectional co-pilot without rework.

**Tech Stack:** FastAPI WebSockets, `python-jose` JWT (reusing `app/core/security.py`), Pydantic schemas, pytest + `TestClient.websocket_connect`; React 18, axios, native browser `WebSocket`, HTML5 Canvas, Jest + React Testing Library, Tailwind semantic tokens (Study Hall).

**Spec:** `docs/superpowers/specs/2026-07-07-live-tutor-session-design.md`

---

## File Structure

**Backend (new):**
- `backend/app/core/live_ticket.py` — mint/validate short-lived single-use WS tickets (JWT, reuses `settings.secret_key`).
- `backend/app/services/live_room_manager.py` — `LiveRoomManager` in-memory room registry (join/leave/relay/broadcast) behind a small interface.
- `backend/app/schemas/live.py` — Pydantic models for the message envelope + `POST /live/token` request/response.
- `backend/app/api/v1/live.py` — `POST /live/token` (REST) and `WS /live/ws/{session_id}` endpoint.
- `backend/app/tests/test_live_ticket.py`, `test_live_room_manager.py`, `test_live_api.py` — tests.

**Backend (modified):**
- `backend/app/api/v1/__init__.py` — register the `live` router.

**Frontend (new):**
- `frontend/src/utils/strokeRenderer.js` — pure "render strokes to a 2D context" helper (extracted from `DrawingCanvas`).
- `frontend/src/services/liveService.js` — ticket fetch + `WebSocket` wrapper (connect, reconnect backoff, send, subscribe, heartbeat).
- `frontend/src/hooks/useLiveSession.js` — React hook over the connection (state, latest snapshot/deltas, `send`).
- `frontend/src/components/live/LiveIndicator.jsx` — student "your tutor joined" banner.
- `frontend/src/components/live/LiveStrokeLayer.jsx` — read-only canvas replaying incoming stroke batches.
- `frontend/src/components/live/TutorLivePanel.jsx` — collapsible coach sidebar (starts expanded).
- `frontend/src/components/live/index.js` — barrel export.
- `frontend/src/pages/tutor/LiveSessionsPage.jsx` — active-sessions list + watch view.
- Test files alongside each (`*.test.js`).

**Frontend (modified):**
- `frontend/src/components/test/DrawingCanvas.jsx` — use the extracted `strokeRenderer` (no behavior change).
- `frontend/src/components/test/ModuleTestInterface.jsx` — add optional `spectator` prop (disables input, drives current question from props) + emit live deltas when a student session is live.
- `frontend/src/services/index.js` — export `liveService`.
- `frontend/src/App.js` — add `/tutor/live` and `/tutor/live/:sessionId` routes.
- `frontend/src/services/tutorService.js` — add `getActiveSessions()`.

**Convention note:** the codebase has zero WebSocket code today. All new backend async WS logic is isolated in `live.py` + `live_room_manager.py`. Do not add Redis. Do not add DB tables (Phase 1 is pure transport).

---

## Task 1: Live ticket mint/validate

**Files:**
- Create: `backend/app/core/live_ticket.py`
- Test: `backend/app/tests/test_live_ticket.py`

A ticket is a short-lived (60s) JWT with `type="live_ticket"` carrying `user_id`, `session_id`, and `role`. Single-use is enforced at connect time by the room manager (Task 8), not here — this module only mints and decodes.

- [ ] **Step 1: Write the failing test**

```python
# backend/app/tests/test_live_ticket.py
"""Tests for live WebSocket ticket minting/validation."""

import time
from datetime import timedelta

from app.core.live_ticket import create_live_ticket, decode_live_ticket


def test_roundtrip_returns_claims():
    token = create_live_ticket(user_id="u-1", session_id="s-1", role="tutor")
    claims = decode_live_ticket(token)
    assert claims is not None
    assert claims["user_id"] == "u-1"
    assert claims["session_id"] == "s-1"
    assert claims["role"] == "tutor"
    assert "jti" in claims  # unique id for single-use tracking


def test_expired_ticket_returns_none():
    token = create_live_ticket(
        user_id="u-1", session_id="s-1", role="student",
        expires_delta=timedelta(seconds=-1),
    )
    assert decode_live_ticket(token) is None


def test_wrong_type_token_rejected():
    # An access token is not a live ticket.
    from app.core.security import create_access_token
    token = create_access_token(subject="u-1")
    assert decode_live_ticket(token) is None


def test_garbage_returns_none():
    assert decode_live_ticket("not-a-jwt") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_ticket.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.live_ticket'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/core/live_ticket.py
"""
Short-lived single-use tickets for authenticating WebSocket handshakes.

Browsers cannot set Authorization headers on WebSocket connections, so the
client fetches a ticket over authenticated REST, then passes it as a query
param on the WS URL. Tickets expire in seconds and carry a unique `jti` the
room manager records to enforce single use.
"""

from datetime import datetime, timedelta
from typing import Optional, Union
import secrets

from jose import JWTError, jwt

from app.config import settings

LIVE_TICKET_EXPIRE_SECONDS = 60


def create_live_ticket(
    user_id: Union[str, int],
    session_id: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Mint a signed live-session ticket."""
    expire = datetime.utcnow() + (
        expires_delta
        if expires_delta is not None
        else timedelta(seconds=LIVE_TICKET_EXPIRE_SECONDS)
    )
    to_encode = {
        "exp": expire,
        "type": "live_ticket",
        "user_id": str(user_id),
        "session_id": str(session_id),
        "role": role,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_live_ticket(token: str) -> Optional[dict]:
    """Return ticket claims if valid and unexpired, else None."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError:
        return None
    if payload.get("type") != "live_ticket":
        return None
    return payload
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_ticket.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/live_ticket.py backend/app/tests/test_live_ticket.py
git commit -m "feat(live): add short-lived WS ticket mint/validate"
```

---

## Task 2: Live message schemas

**Files:**
- Create: `backend/app/schemas/live.py`
- Test: `backend/app/tests/test_live_schemas.py`

Defines the JSON message envelope and the `POST /live/token` request/response models. Message `type` is validated against the Phase-1 allowed set; unknown types are rejected so a buggy client can't inject arbitrary payloads.

- [ ] **Step 1: Write the failing test**

```python
# backend/app/tests/test_live_schemas.py
import pytest
from pydantic import ValidationError

from app.schemas.live import LiveMessage, LiveTokenRequest, LiveTokenResponse


def test_valid_message_parses():
    msg = LiveMessage(
        type="answer_selected",
        session_id="s-1",
        sender_role="student",
        seq=3,
        payload={"question_id": "q-1", "selected_answer": 2},
    )
    assert msg.type == "answer_selected"
    assert msg.payload["selected_answer"] == 2


def test_unknown_type_rejected():
    with pytest.raises(ValidationError):
        LiveMessage(
            type="delete_everything",
            session_id="s-1",
            sender_role="student",
            seq=1,
            payload={},
        )


def test_bad_role_rejected():
    with pytest.raises(ValidationError):
        LiveMessage(
            type="heartbeat", session_id="s-1",
            sender_role="hacker", seq=1, payload={},
        )


def test_token_request_and_response():
    req = LiveTokenRequest(session_id="s-1")
    assert req.session_id == "s-1"
    resp = LiveTokenResponse(ticket="abc", ws_path="/api/v1/live/ws/s-1")
    assert resp.ticket == "abc"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.live'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/schemas/live.py
"""Pydantic models for live-session WebSocket messages and token requests."""

from typing import Any, Dict, Literal

from pydantic import BaseModel, Field

# Phase-1 message types. Phase 2 adds cursor/highlight/navigate/reveal and
# bidirectional stroke_batch — extend this Literal, no other change needed.
MessageType = Literal[
    "presence",
    "snapshot",
    "question_changed",
    "answer_selected",
    "stroke_batch",
    "tutor_joined",
    "tutor_left",
    "heartbeat",
]

SenderRole = Literal["student", "tutor", "server"]


class LiveMessage(BaseModel):
    """Envelope for every message relayed over a live room."""

    type: MessageType
    session_id: str
    sender_role: SenderRole
    seq: int = 0
    payload: Dict[str, Any] = Field(default_factory=dict)


class LiveTokenRequest(BaseModel):
    session_id: str


class LiveTokenResponse(BaseModel):
    ticket: str
    ws_path: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_schemas.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/live.py backend/app/tests/test_live_schemas.py
git commit -m "feat(live): add live message envelope + token schemas"
```

---

## Task 3: LiveRoomManager — room join/leave

**Files:**
- Create: `backend/app/services/live_room_manager.py`
- Test: `backend/app/tests/test_live_room_manager.py`

The manager holds `session_id -> Room`. A `Room` has one optional student connection and a set of tutor connections. Connections are represented by a minimal `LiveConnection` protocol (an object with an async `send_json`) so tests can use fakes without real sockets. This task covers join/leave + emptiness; relay is Task 4.

- [ ] **Step 1: Write the failing test**

```python
# backend/app/tests/test_live_room_manager.py
import pytest

from app.services.live_room_manager import LiveRoomManager


class FakeConn:
    """Stand-in for a WebSocket; records messages sent to it."""
    def __init__(self):
        self.sent = []

    async def send_json(self, data):
        self.sent.append(data)


@pytest.mark.asyncio
async def test_join_creates_room_and_tracks_roles():
    mgr = LiveRoomManager()
    student = FakeConn()
    tutor = FakeConn()

    await mgr.join("s-1", role="student", conn=student)
    await mgr.join("s-1", role="tutor", conn=tutor)

    assert mgr.room_exists("s-1")
    assert mgr.student_present("s-1") is True
    assert mgr.tutor_count("s-1") == 1


@pytest.mark.asyncio
async def test_leave_removes_room_when_empty():
    mgr = LiveRoomManager()
    student = FakeConn()

    await mgr.join("s-1", role="student", conn=student)
    await mgr.leave("s-1", role="student", conn=student)

    assert mgr.room_exists("s-1") is False


@pytest.mark.asyncio
async def test_multiple_tutors_allowed():
    mgr = LiveRoomManager()
    t1, t2 = FakeConn(), FakeConn()
    await mgr.join("s-1", role="tutor", conn=t1)
    await mgr.join("s-1", role="tutor", conn=t2)
    assert mgr.tutor_count("s-1") == 2
```

Note: `pytest-asyncio` is required. If `cd backend && python -m pytest app/tests/test_live_room_manager.py` errors with "async def functions are not natively supported", add `pytest-asyncio` to `backend/requirements.txt` and create `backend/pytest.ini` with:

```ini
[pytest]
asyncio_mode = auto
```

Then `pip install pytest-asyncio`. Commit that config change as part of Step 5.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_room_manager.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.live_room_manager'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/services/live_room_manager.py
"""
In-memory registry of live tutoring rooms.

One room per TestSession. A room holds at most one student connection and a
set of tutor connections. Rooms are created lazily on first join and dropped
when empty, so idle memory is ~zero.

This is deliberately behind a small class so a Redis-backed pub/sub
implementation can replace it later without touching the API layer. Do NOT
add Redis in Phase 1 — a single Railway instance makes in-process fan-out
correct.
"""

from typing import Dict, Optional, Protocol, Set


class LiveConnection(Protocol):
    async def send_json(self, data: dict) -> None: ...


class Room:
    def __init__(self) -> None:
        self.student: Optional[LiveConnection] = None
        self.tutors: Set[LiveConnection] = set()

    def is_empty(self) -> bool:
        return self.student is None and not self.tutors


class LiveRoomManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, Room] = {}

    def room_exists(self, session_id: str) -> bool:
        return session_id in self._rooms

    def student_present(self, session_id: str) -> bool:
        room = self._rooms.get(session_id)
        return room is not None and room.student is not None

    def tutor_count(self, session_id: str) -> int:
        room = self._rooms.get(session_id)
        return len(room.tutors) if room else 0

    async def join(self, session_id: str, role: str, conn: LiveConnection) -> None:
        room = self._rooms.setdefault(session_id, Room())
        if role == "student":
            room.student = conn
        elif role == "tutor":
            room.tutors.add(conn)

    async def leave(self, session_id: str, role: str, conn: LiveConnection) -> None:
        room = self._rooms.get(session_id)
        if room is None:
            return
        if role == "student" and room.student is conn:
            room.student = None
        elif role == "tutor":
            room.tutors.discard(conn)
        if room.is_empty():
            del self._rooms[session_id]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_room_manager.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/live_room_manager.py backend/app/tests/test_live_room_manager.py backend/requirements.txt backend/pytest.ini
git commit -m "feat(live): add LiveRoomManager room join/leave"
```

---

## Task 4: LiveRoomManager — relay + broadcast + single-use tickets

**Files:**
- Modify: `backend/app/services/live_room_manager.py`
- Test: `backend/app/tests/test_live_room_manager.py` (add tests)

Add: `relay_to_tutors` (student→tutors), `broadcast_to_student` (server/tutor→student), and `consume_ticket(jti)` which returns `False` if the jti was already used (single-use enforcement).

- [ ] **Step 1: Write the failing test (append to existing file)**

```python
@pytest.mark.asyncio
async def test_relay_to_tutors_reaches_all_tutors_not_student():
    mgr = LiveRoomManager()
    student, t1, t2 = FakeConn(), FakeConn(), FakeConn()
    await mgr.join("s-1", role="student", conn=student)
    await mgr.join("s-1", role="tutor", conn=t1)
    await mgr.join("s-1", role="tutor", conn=t2)

    await mgr.relay_to_tutors("s-1", {"type": "answer_selected"})

    assert t1.sent == [{"type": "answer_selected"}]
    assert t2.sent == [{"type": "answer_selected"}]
    assert student.sent == []  # student never receives their own relay


@pytest.mark.asyncio
async def test_broadcast_to_student_reaches_student_only():
    mgr = LiveRoomManager()
    student, tutor = FakeConn(), FakeConn()
    await mgr.join("s-1", role="student", conn=student)
    await mgr.join("s-1", role="tutor", conn=tutor)

    await mgr.broadcast_to_student("s-1", {"type": "tutor_joined"})

    assert student.sent == [{"type": "tutor_joined"}]
    assert tutor.sent == []


@pytest.mark.asyncio
async def test_relay_on_missing_room_is_noop():
    mgr = LiveRoomManager()
    await mgr.relay_to_tutors("nope", {"type": "x"})  # must not raise


def test_ticket_single_use():
    mgr = LiveRoomManager()
    assert mgr.consume_ticket("jti-1") is True
    assert mgr.consume_ticket("jti-1") is False  # already used
    assert mgr.consume_ticket("jti-2") is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_room_manager.py -v`
Expected: FAIL — `AttributeError: 'LiveRoomManager' object has no attribute 'relay_to_tutors'`

- [ ] **Step 3: Write minimal implementation (edit the class)**

Add to `__init__`:

```python
        self._used_tickets: Set[str] = set()
```

Add these methods to `LiveRoomManager`:

```python
    def consume_ticket(self, jti: str) -> bool:
        """Return True the first time a jti is seen, False afterward."""
        if jti in self._used_tickets:
            return False
        self._used_tickets.add(jti)
        return True

    async def relay_to_tutors(self, session_id: str, message: dict) -> None:
        room = self._rooms.get(session_id)
        if room is None:
            return
        for tutor in list(room.tutors):
            await tutor.send_json(message)

    async def broadcast_to_student(self, session_id: str, message: dict) -> None:
        room = self._rooms.get(session_id)
        if room is None or room.student is None:
            return
        await room.student.send_json(message)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_room_manager.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/live_room_manager.py backend/app/tests/test_live_room_manager.py
git commit -m "feat(live): add relay, broadcast, single-use ticket tracking"
```

---

## Task 5: `POST /live/token` endpoint + router registration

**Files:**
- Create: `backend/app/api/v1/live.py`
- Modify: `backend/app/api/v1/__init__.py:9,` (import) and add `include_router`
- Test: `backend/app/tests/test_live_api.py`

The REST endpoint authorizes the caller for the session, then mints a ticket. Authorization: a student may request a ticket for a session they own; a tutor may request one for a session belonging to a student on their roster. This reuses the `_get_student_or_404` ownership rule inline (via a query) to avoid a cross-module import.

- [ ] **Step 1: Write the failing test**

```python
# backend/app/tests/test_live_api.py
"""Tests for the live-session REST + WebSocket endpoints."""

import pytest
from uuid import uuid4

from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.enums import UserRole, TestType, TestStatus
from app.models.test import TestSession


def _mk_user(db, role, tutor_id=None):
    user = User(
        id=uuid4(),
        email=f"{uuid4().hex[:8]}@ex.com",
        hashed_password=get_password_hash("Passw0rd!"),
        full_name="X",
        role=role,
        is_active=True,
        tutor_id=tutor_id,
    )
    db.add(user)
    db.commit()
    return user


def _mk_session(db, student_id):
    session = TestSession(
        id=uuid4(),
        student_id=student_id,
        test_type=TestType.PRACTICE,
        status=TestStatus.IN_PROGRESS,
    )
    db.add(session)
    db.commit()
    return session


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(subject=str(user.id))}"}


def test_student_gets_ticket_for_own_session(client, db):
    student = _mk_user(db, UserRole.STUDENT)
    session = _mk_session(db, student.id)
    r = client.post(
        "/api/v1/live/token",
        json={"session_id": str(session.id)},
        headers=_auth(student),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ticket"]
    assert body["ws_path"].endswith(str(session.id))


def test_tutor_gets_ticket_for_roster_student_session(client, db):
    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    session = _mk_session(db, student.id)
    r = client.post(
        "/api/v1/live/token",
        json={"session_id": str(session.id)},
        headers=_auth(tutor),
    )
    assert r.status_code == 200


def test_tutor_denied_for_non_roster_session(client, db):
    tutor = _mk_user(db, UserRole.TUTOR)
    other_student = _mk_user(db, UserRole.STUDENT)  # not on tutor's roster
    session = _mk_session(db, other_student.id)
    r = client.post(
        "/api/v1/live/token",
        json={"session_id": str(session.id)},
        headers=_auth(tutor),
    )
    assert r.status_code == 403


def test_unauthenticated_denied(client, db):
    r = client.post("/api/v1/live/token", json={"session_id": str(uuid4())})
    assert r.status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: FAIL — 404 on `/api/v1/live/token` (router not registered) / import error.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/api/v1/live.py
"""
Live tutoring session endpoints.

- POST /live/token: authenticated REST; authorizes the caller for a session and
  mints a short-lived single-use WS ticket.
- WS /live/ws/{session_id}: the live room connection (added in Task 8).

The socket only mirrors state for observers; the student's answers continue to
flow through the existing practice/assignment/adaptive REST endpoints, so a
dropped socket never affects the student's test.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.live_ticket import create_live_ticket
from app.models.enums import UserRole
from app.models.test import TestSession
from app.models.user import User
from app.schemas.live import LiveTokenRequest, LiveTokenResponse
from app.services.live_room_manager import LiveRoomManager

router = APIRouter()

# Module-level singleton: the room registry lives for the process lifetime.
room_manager = LiveRoomManager()


def _authorize_session(session_id: UUID, user: User, db: Session) -> tuple[TestSession, str]:
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
```

Register the router — edit `backend/app/api/v1/__init__.py`:

```python
# line 9: add `live` to the import list
from app.api.v1 import auth, questions, taxonomy, practice, progress, assignments, tutor, adaptive, lessons, recommendations, reports, practice_tests, join, worklist, live

# after the worklist include:
api_router.include_router(live.router, prefix="/live", tags=["Live Session"])
```

Note: the router already declares full paths starting with `/live/...` in the decorators. To avoid a double prefix (`/live/live/token`), register WITHOUT a prefix instead:

```python
api_router.include_router(live.router, tags=["Live Session"])
```

Keep the `@router.post("/live/token")` and `@router.websocket("/live/ws/{session_id}")` decorators carrying the full `/live` path (mirrors the `join`/`worklist` convention on line 25-26).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/live.py backend/app/api/v1/__init__.py backend/app/tests/test_live_api.py
git commit -m "feat(live): add POST /live/token endpoint + register router"
```

---

## Task 6: Active-sessions endpoint for the tutor list

**Files:**
- Modify: `backend/app/api/v1/live.py` (add `GET /live/active`)
- Test: `backend/app/tests/test_live_api.py` (add test)

The tutor's live page needs to know which of their students have a live room open right now. This reads the in-memory `room_manager` (which sessions have a student connected) intersected with the tutor's roster + the session's student.

- [ ] **Step 1: Write the failing test (append)**

```python
def test_active_sessions_lists_only_rooms_with_connected_student(client, db):
    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    session = _mk_session(db, student.id)

    from app.api.v1.live import room_manager

    class _Fake:
        async def send_json(self, d): pass

    import asyncio
    asyncio.get_event_loop().run_until_complete(
        room_manager.join(str(session.id), role="student", conn=_Fake())
    )

    r = client.get("/api/v1/live/active", headers=_auth(tutor))
    assert r.status_code == 200
    items = r.json()["sessions"]
    assert any(s["session_id"] == str(session.id) for s in items)
    assert items[0]["student_name"] == student.full_name

    # cleanup so the module-level manager doesn't leak into other tests
    asyncio.get_event_loop().run_until_complete(
        room_manager.leave(str(session.id), role="student", conn=_Fake())
    )
```

Note: because the fake conn identity differs on leave, also expose a test helper. Simpler: add `room_manager._rooms.clear()` at the end. Use:

```python
    from app.api.v1.live import room_manager as rm
    rm._rooms.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_api.py::test_active_sessions_lists_only_rooms_with_connected_student -v`
Expected: FAIL — 404 (no `/live/active` route).

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app/api/v1/live.py`:

```python
from typing import List
from pydantic import BaseModel
from app.api.deps import get_current_tutor


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
    # session_ids that currently have a connected student, for this tutor's roster
    live_ids = [sid for sid in room_manager.active_student_session_ids()]
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
```

Add to `LiveRoomManager` (in `live_room_manager.py`):

```python
    def active_student_session_ids(self) -> list[str]:
        """Session ids that currently have a connected student."""
        return [sid for sid, room in self._rooms.items() if room.student is not None]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: PASS (all in file)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/live.py backend/app/services/live_room_manager.py backend/app/tests/test_live_api.py
git commit -m "feat(live): add GET /live/active for tutor live-sessions list"
```

---

## Task 7: WebSocket endpoint — connect, auth, relay

**Files:**
- Modify: `backend/app/api/v1/live.py` (add the `@router.websocket` endpoint)
- Test: `backend/app/tests/test_live_api.py` (add WS tests)

The WS endpoint: accepts, reads `ticket` query param, validates it (Task 1), confirms `session_id` in the path matches the ticket, enforces single-use via `room_manager.consume_ticket(jti)`, joins the room, and enters a receive loop. Student messages are relayed to tutors; when a tutor joins, the student is notified with `tutor_joined`; on disconnect the peer is notified and the room cleans up.

A small adapter wraps FastAPI's `WebSocket` to satisfy the `LiveConnection` protocol (`send_json`).

- [ ] **Step 1: Write the failing test (append)**

```python
def test_ws_rejects_missing_ticket(client, db):
    student = _mk_user(db, UserRole.STUDENT)
    session = _mk_session(db, student.id)
    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/v1/live/ws/{session.id}"):
            pass


def test_ws_student_join_then_tutor_relay(client, db):
    from app.core.live_ticket import create_live_ticket
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()
    room_manager._used_tickets.clear()

    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    session = _mk_session(db, student.id)
    sid = str(session.id)

    s_ticket = create_live_ticket(user_id=str(student.id), session_id=sid, role="student")
    t_ticket = create_live_ticket(user_id=str(tutor.id), session_id=sid, role="tutor")

    with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={s_ticket}") as s_ws:
        # student announces presence
        s_ws.send_json({"type": "presence", "session_id": sid,
                        "sender_role": "student", "seq": 1,
                        "payload": {"status": "active", "surface": "practice"}})

        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            # student should be told a tutor joined
            joined = s_ws.receive_json()
            assert joined["type"] == "tutor_joined"

            # student answers -> tutor receives the relay
            s_ws.send_json({"type": "answer_selected", "session_id": sid,
                            "sender_role": "student", "seq": 2,
                            "payload": {"question_id": "q1", "selected_answer": 2}})
            relayed = t_ws.receive_json()
            assert relayed["type"] == "answer_selected"
            assert relayed["payload"]["selected_answer"] == 2

    room_manager._rooms.clear()


def test_ws_reused_ticket_rejected(client, db):
    from app.core.live_ticket import create_live_ticket
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()
    room_manager._used_tickets.clear()

    student = _mk_user(db, UserRole.STUDENT)
    session = _mk_session(db, student.id)
    sid = str(session.id)
    ticket = create_live_ticket(user_id=str(student.id), session_id=sid, role="student")

    with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={ticket}"):
        pass
    # second use of the same ticket must be rejected
    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={ticket}"):
            pass
    room_manager._rooms.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: FAIL — WS route missing; connections raise on handshake.

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app/api/v1/live.py`:

```python
from fastapi import WebSocket, WebSocketDisconnect
from app.core.live_ticket import decode_live_ticket
from app.schemas.live import LiveMessage


class _WSAdapter:
    """Adapts FastAPI WebSocket to the LiveConnection protocol."""
    def __init__(self, ws: WebSocket):
        self._ws = ws

    async def send_json(self, data: dict) -> None:
        await self._ws.send_json(data)


@router.websocket("/live/ws/{session_id}")
async def live_ws(websocket: WebSocket, session_id: str):
    ticket = websocket.query_params.get("ticket")
    claims = decode_live_ticket(ticket) if ticket else None

    # Validate ticket, path/session match, and single use BEFORE accepting.
    if (
        claims is None
        or claims.get("session_id") != session_id
        or not room_manager.consume_ticket(claims.get("jti", ""))
    ):
        await websocket.close(code=4401)  # 4401: unauthorized (app-defined)
        return

    role = claims.get("role")
    await websocket.accept()
    conn = _WSAdapter(websocket)
    await room_manager.join(session_id, role=role, conn=conn)

    # Notify the student when a tutor joins.
    if role == "tutor":
        await room_manager.broadcast_to_student(
            session_id,
            {"type": "tutor_joined", "session_id": session_id,
             "sender_role": "server", "seq": 0, "payload": {}},
        )

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                msg = LiveMessage(**raw)
            except Exception:
                continue  # ignore malformed messages
            if msg.type == "heartbeat":
                continue
            # Phase 1: student state is mirrored to tutors. (Phase 2 relays
            # tutor->student for cursor/highlight/navigate/reveal.)
            if role == "student":
                await room_manager.relay_to_tutors(session_id, msg.model_dump())
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: PASS (all in file)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/live.py backend/app/tests/test_live_api.py
git commit -m "feat(live): add WebSocket endpoint with ticket auth + relay"
```

---

## Task 8: WS snapshot on tutor join

**Files:**
- Modify: `backend/app/api/v1/live.py`
- Test: `backend/app/tests/test_live_api.py` (add test)

When a tutor joins, they need current state immediately. The endpoint builds a snapshot from the DB (`TestSession.current_question_index` and the student's latest `StudentResponse` for the current question) and sends it to the joining tutor only. (The student's live drawing comes separately: the client re-sends its current `stroke_batch` on receiving `tutor_joined` — handled on the frontend in Task 13.)

- [ ] **Step 1: Write the failing test (append)**

```python
def test_ws_tutor_receives_snapshot_on_join(client, db):
    from app.core.live_ticket import create_live_ticket
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()
    room_manager._used_tickets.clear()

    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    session = _mk_session(db, student.id)
    session.current_question_index = 3
    db.commit()
    sid = str(session.id)

    s_ticket = create_live_ticket(user_id=str(student.id), session_id=sid, role="student")
    t_ticket = create_live_ticket(user_id=str(tutor.id), session_id=sid, role="tutor")

    with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={s_ticket}"):
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            first = t_ws.receive_json()
            assert first["type"] == "snapshot"
            assert first["payload"]["question_index"] == 3
    room_manager._rooms.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_api.py::test_ws_tutor_receives_snapshot_on_join -v`
Expected: FAIL — tutor's first message is `tutor_joined`-adjacent, not `snapshot` / KeyError.

- [ ] **Step 3: Write minimal implementation**

Add a helper and call it in the WS endpoint right after a tutor joins (before/instead-of ordering: send snapshot to the tutor first, then notify student). Insert into `live_ws` in the `if role == "tutor":` block:

```python
    if role == "tutor":
        # Build snapshot from DB and send to the joining tutor only.
        from app.database import SessionLocal
        db = SessionLocal()
        try:
            snap = _build_snapshot(session_id, db)
        finally:
            db.close()
        await conn.send_json({
            "type": "snapshot", "session_id": session_id,
            "sender_role": "server", "seq": 0, "payload": snap,
        })
        await room_manager.broadcast_to_student(
            session_id,
            {"type": "tutor_joined", "session_id": session_id,
             "sender_role": "server", "seq": 0, "payload": {}},
        )
```

Add the helper (module level in `live.py`):

```python
from app.models.response import StudentResponse


def _build_snapshot(session_id: str, db: Session) -> dict:
    session = db.query(TestSession).filter(TestSession.id == UUID(session_id)).first()
    if session is None:
        return {"question_index": None, "question_id": None, "selected_answer": None}
    idx = session.current_question_index
    # Latest response for this session (most recent answer the student gave).
    latest = (
        db.query(StudentResponse)
        .filter(StudentResponse.test_session_id == session.id)
        .order_by(StudentResponse.submitted_at.desc())
        .first()
    )
    return {
        "question_index": idx,
        "question_id": str(latest.question_id) if latest else None,
        "selected_answer": latest.response_json if latest else None,
    }
```

Remove the now-duplicated `tutor_joined` broadcast that Task 7 added at the top of the `if role == "tutor":` block (it now lives inside the snapshot block above, after the snapshot send).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: PASS (all in file)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/live.py backend/app/tests/test_live_api.py
git commit -m "feat(live): send DB snapshot to tutor on join"
```

---

## Task 9: Extract strokeRenderer from DrawingCanvas

**Files:**
- Create: `frontend/src/utils/strokeRenderer.js`
- Test: `frontend/src/utils/strokeRenderer.test.js`
- Modify: `frontend/src/components/test/DrawingCanvas.jsx` (use the helper)

Extract the pure "draw an array of strokes to a 2D context" loop so both `DrawingCanvas` and the new `LiveStrokeLayer` share one implementation. Match the existing stroke shape: `{color, size, eraser, points:[{x,y}]}`.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/utils/strokeRenderer.test.js
import { renderStrokes } from './strokeRenderer';

function makeFakeCtx() {
  const calls = [];
  return {
    calls,
    beginPath: () => calls.push(['beginPath']),
    moveTo: (x, y) => calls.push(['moveTo', x, y]),
    lineTo: (x, y) => calls.push(['lineTo', x, y]),
    stroke: () => calls.push(['stroke']),
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    set lineCap(v) {},
    set lineJoin(v) {},
    set globalCompositeOperation(v) { calls.push(['gco', v]); },
  };
}

test('renders a stroke as moveTo + lineTo sequence', () => {
  const ctx = makeFakeCtx();
  renderStrokes(ctx, [
    { color: '#111827', size: 3, eraser: false, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
  ]);
  expect(ctx.calls).toContainEqual(['moveTo', 0, 0]);
  expect(ctx.calls).toContainEqual(['lineTo', 5, 5]);
  expect(ctx.calls).toContainEqual(['stroke']);
});

test('eraser stroke sets destination-out composite op', () => {
  const ctx = makeFakeCtx();
  renderStrokes(ctx, [
    { color: '#fff', size: 22, eraser: true, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] },
  ]);
  expect(ctx.calls).toContainEqual(['gco', 'destination-out']);
});

test('supports an x/y offset for panel/scroll shifts', () => {
  const ctx = makeFakeCtx();
  renderStrokes(
    ctx,
    [{ color: '#000', size: 3, eraser: false, points: [{ x: 10, y: 10 }] }],
    { offsetX: 100, offsetY: 0 },
  );
  expect(ctx.calls).toContainEqual(['moveTo', 110, 10]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/utils/strokeRenderer.test.js`
Expected: FAIL — Cannot find module './strokeRenderer'

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/src/utils/strokeRenderer.js
/**
 * Pure stroke rendering shared by the student's DrawingCanvas and the tutor's
 * read-only LiveStrokeLayer. A stroke is {color, size, eraser, points:[{x,y}]}
 * in world-space coordinates; callers pass an offset to map world-space to the
 * local canvas (e.g. when a calculator panel shifts content or on scroll).
 */
export function renderStrokes(ctx, strokes, { offsetX = 0, offsetY = 0 } = {}) {
  if (!ctx || !strokes) return;
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;
    ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const [first, ...rest] = stroke.points;
    ctx.moveTo(first.x + offsetX, first.y + offsetY);
    if (rest.length === 0) {
      // a single point: draw a dot as a zero-length line
      ctx.lineTo(first.x + offsetX, first.y + offsetY);
    } else {
      for (const p of rest) ctx.lineTo(p.x + offsetX, p.y + offsetY);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}
```

Then refactor `DrawingCanvas.jsx`'s redraw loop to call `renderStrokes`. Find the existing `redrawAll` function (around line 69-74 / 198-204) that iterates strokes and replace its inner drawing loop with:

```javascript
import { renderStrokes } from '../../utils/strokeRenderer';
// inside redrawAll, after clearing the canvas and computing xOffsetRef.current:
renderStrokes(ctx, strokesMap.get(currentQuestionId) || [], { offsetX: xOffsetRef.current, offsetY: 0 });
```

Preserve the existing clear/scale logic; only the per-stroke drawing loop is replaced. Do not change the input-handling (pointer) code.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && CI=true npx jest src/utils/strokeRenderer.test.js`
Expected: PASS (3 passed)

Then verify DrawingCanvas still builds:
Run: `cd frontend && CI=true npm run build`
Expected: build succeeds (no import errors).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/strokeRenderer.js frontend/src/utils/strokeRenderer.test.js frontend/src/components/test/DrawingCanvas.jsx
git commit -m "refactor(test): extract shared strokeRenderer from DrawingCanvas"
```

---

## Task 10: liveService — ticket fetch + WebSocket wrapper

**Files:**
- Create: `frontend/src/services/liveService.js`
- Modify: `frontend/src/services/index.js` (export it)
- Test: `frontend/src/services/liveService.test.js`

`liveService.connect({ sessionId, onMessage, onStatusChange })` fetches a ticket via `api.post('/live/token')`, opens a `WebSocket` to the backend, dispatches parsed messages to `onMessage`, and returns a handle with `send(msg)` and `close()`. Reconnect-with-backoff is added in Task 11 to keep this task small.

The WS base URL is derived from `REACT_APP_API_URL` (http→ws, https→wss), stripping the `/api/v1` suffix and re-appending the returned `ws_path`.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/services/liveService.test.js
import { buildWsUrl } from './liveService';

test('http api url -> ws url with ws_path', () => {
  const url = buildWsUrl('http://localhost:8000/api/v1', '/api/v1/live/ws/s-1', 'TICKET');
  expect(url).toBe('ws://localhost:8000/api/v1/live/ws/s-1?ticket=TICKET');
});

test('https api url -> wss url', () => {
  const url = buildWsUrl('https://api.example.com/api/v1', '/api/v1/live/ws/s-1', 'T');
  expect(url).toBe('wss://api.example.com/api/v1/live/ws/s-1?ticket=T');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/services/liveService.test.js`
Expected: FAIL — Cannot find module './liveService'

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/src/services/liveService.js
/**
 * Live tutoring session transport.
 *
 * Fetches a short-lived WS ticket over authenticated REST, then opens a
 * WebSocket. The socket only mirrors state; the student's answers still go
 * through the normal REST endpoints, so a dropped socket is non-fatal.
 */
import api from './api';

/** Derive the ws(s):// URL from the REST base URL + returned ws_path. */
export function buildWsUrl(apiBaseUrl, wsPath, ticket) {
  // apiBaseUrl looks like http(s)://host[:port]/api/v1
  const origin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  const wsOrigin = origin.replace(/^http/, 'ws'); // http->ws, https->wss
  return `${wsOrigin}${wsPath}?ticket=${ticket}`;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export async function connect({ sessionId, onMessage, onStatusChange }) {
  onStatusChange && onStatusChange('connecting');
  const { data } = await api.post('/live/token', { session_id: sessionId });
  const url = buildWsUrl(API_BASE_URL, data.ws_path, data.ticket);
  const ws = new WebSocket(url);

  ws.onopen = () => onStatusChange && onStatusChange('connected');
  ws.onclose = () => onStatusChange && onStatusChange('disconnected');
  ws.onerror = () => onStatusChange && onStatusChange('error');
  ws.onmessage = (evt) => {
    try {
      onMessage && onMessage(JSON.parse(evt.data));
    } catch (_) { /* ignore malformed frames */ }
  };

  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close: () => ws.close(),
    raw: ws,
  };
}

const liveService = { connect, buildWsUrl };
export default liveService;
```

Add to `frontend/src/services/index.js`:

```javascript
export { default as liveService } from './liveService';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx jest src/services/liveService.test.js`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/liveService.js frontend/src/services/liveService.test.js frontend/src/services/index.js
git commit -m "feat(live): add liveService ticket fetch + WebSocket wrapper"
```

---

## Task 11: useLiveSession hook (with reconnect + heartbeat)

**Files:**
- Create: `frontend/src/hooks/useLiveSession.js`
- Test: `frontend/src/hooks/useLiveSession.test.js`

A hook that owns the connection lifecycle: connects on mount when `enabled`, exposes `status`, the latest `snapshot`, the last message of each delta type, and a `send()`. On unexpected close it reconnects with exponential backoff (1s→2s→4s, cap 30s). It sends a `heartbeat` every 20s. Uses a mocked `liveService` in tests.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/hooks/useLiveSession.test.js
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveSession } from './useLiveSession';
import { liveService } from '../services';

jest.mock('../services', () => {
  return { liveService: { connect: jest.fn() } };
});

test('connects when enabled and exposes incoming messages', async () => {
  let captured;
  liveService.connect.mockImplementation(async ({ onMessage, onStatusChange }) => {
    captured = { onMessage, onStatusChange };
    onStatusChange('connected');
    return { send: jest.fn(), close: jest.fn() };
  });

  const { result } = renderHook(() =>
    useLiveSession({ sessionId: 's-1', role: 'tutor', enabled: true })
  );

  await waitFor(() => expect(result.current.status).toBe('connected'));

  act(() => {
    captured.onMessage({ type: 'question_changed', payload: { question_index: 4 } });
  });
  expect(result.current.lastByType.question_changed.payload.question_index).toBe(4);
});

test('does not connect when disabled', () => {
  renderHook(() => useLiveSession({ sessionId: 's-1', role: 'tutor', enabled: false }));
  expect(liveService.connect).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/hooks/useLiveSession.test.js`
Expected: FAIL — Cannot find module './useLiveSession'

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/src/hooks/useLiveSession.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { liveService } from '../services';

const HEARTBEAT_MS = 20000;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30000;

/**
 * Owns a live-session WebSocket. Mirrors student state to a watching tutor, or
 * carries a student's outbound deltas. Reconnects with backoff; sends
 * heartbeats. `enabled` gates connection so it only runs when a live view is open.
 */
export function useLiveSession({ sessionId, role, enabled = true }) {
  const [status, setStatus] = useState('idle');
  const [snapshot, setSnapshot] = useState(null);
  const [lastByType, setLastByType] = useState({});
  const handleRef = useRef(null);
  const backoffRef = useRef(BACKOFF_START_MS);
  const heartbeatRef = useRef(null);
  const closedByUs = useRef(false);

  const handleMessage = useCallback((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'snapshot') setSnapshot(msg.payload);
    setLastByType((prev) => ({ ...prev, [msg.type]: msg }));
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId) return undefined;
    closedByUs.current = false;
    let cancelled = false;

    const open = async () => {
      try {
        const handle = await liveService.connect({
          sessionId,
          onMessage: handleMessage,
          onStatusChange: (s) => {
            setStatus(s);
            if (s === 'connected') {
              backoffRef.current = BACKOFF_START_MS;
              heartbeatRef.current = setInterval(() => {
                handle.send({ type: 'heartbeat', session_id: sessionId,
                  sender_role: role, seq: 0, payload: {} });
              }, HEARTBEAT_MS);
            }
            if ((s === 'disconnected' || s === 'error') && !closedByUs.current && !cancelled) {
              clearInterval(heartbeatRef.current);
              const delay = backoffRef.current;
              backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
              setTimeout(() => { if (!cancelled) open(); }, delay);
            }
          },
        });
        if (cancelled) { handle.close(); return; }
        handleRef.current = handle;
      } catch (_) {
        if (!cancelled) {
          const delay = backoffRef.current;
          backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
          setTimeout(() => { if (!cancelled) open(); }, delay);
        }
      }
    };
    open();

    return () => {
      cancelled = true;
      closedByUs.current = true;
      clearInterval(heartbeatRef.current);
      if (handleRef.current) handleRef.current.close();
    };
  }, [enabled, sessionId, role, handleMessage]);

  const send = useCallback((msg) => {
    if (handleRef.current) handleRef.current.send(msg);
  }, []);

  return { status, snapshot, lastByType, send };
}

export default useLiveSession;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx jest src/hooks/useLiveSession.test.js`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useLiveSession.js frontend/src/hooks/useLiveSession.test.js
git commit -m "feat(live): add useLiveSession hook with reconnect + heartbeat"
```

---

## Task 12: LiveIndicator (student-facing) + LiveStrokeLayer

**Files:**
- Create: `frontend/src/components/live/LiveIndicator.jsx`
- Create: `frontend/src/components/live/LiveStrokeLayer.jsx`
- Create: `frontend/src/components/live/index.js`
- Test: `frontend/src/components/live/LiveIndicator.test.js`

`LiveIndicator` shows a calm banner when a tutor is present (driven by `tutor_joined`/`tutor_left`). `LiveStrokeLayer` is an absolutely-positioned read-only canvas that renders incoming stroke batches via `renderStrokes` (Task 9).

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/live/LiveIndicator.test.js
import { render, screen } from '@testing-library/react';
import { LiveIndicator } from './index';

test('renders nothing when tutor absent', () => {
  const { container } = render(<LiveIndicator present={false} tutorName="Sam" />);
  expect(container).toBeEmptyDOMElement();
});

test('announces the tutor when present', () => {
  render(<LiveIndicator present={true} tutorName="Sam" />);
  expect(screen.getByText(/Sam/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/components/live/LiveIndicator.test.js`
Expected: FAIL — Cannot find module './index'

- [ ] **Step 3: Write minimal implementation**

```jsx
// frontend/src/components/live/LiveIndicator.jsx
import React from 'react';

/**
 * Calm, non-anxiety banner shown to the student when a tutor is watching.
 * Color is paired with text + icon (never color alone). Study Hall tokens.
 */
export default function LiveIndicator({ present, tutorName }) {
  if (!present) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-edge bg-brand-50 px-3 py-2 text-sm text-ink"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
      <span>{tutorName ? `${tutorName} is here with you` : 'Your tutor is here with you'}</span>
    </div>
  );
}
```

```jsx
// frontend/src/components/live/LiveStrokeLayer.jsx
import React, { useEffect, useRef } from 'react';
import { renderStrokes } from '../../utils/strokeRenderer';

/**
 * Read-only canvas overlay that replays stroke batches received over the live
 * session. Phase 1: shows the student's drawing to the tutor. Reuses the same
 * renderer as DrawingCanvas so the two never diverge.
 */
export default function LiveStrokeLayer({ strokes, width, height, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderStrokes(ctx, strokes || []);
  }, [strokes, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
    />
  );
}
```

```javascript
// frontend/src/components/live/index.js
export { default as LiveIndicator } from './LiveIndicator';
export { default as LiveStrokeLayer } from './LiveStrokeLayer';
export { default as TutorLivePanel } from './TutorLivePanel';
```

Note: `TutorLivePanel` is created in Task 13; the barrel export references it now so the file is complete. If running Task 12's build before Task 13, temporarily omit the `TutorLivePanel` line and add it in Task 13.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx jest src/components/live/LiveIndicator.test.js`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/live/
git commit -m "feat(live): add LiveIndicator + LiveStrokeLayer components"
```

---

## Task 13: TutorLivePanel (collapsible coach sidebar)

**Files:**
- Create: `frontend/src/components/live/TutorLivePanel.jsx`
- Test: `frontend/src/components/live/TutorLivePanel.test.js`

The Option-B panel: starts **expanded**, collapses to a thin rail. Shows the correct answer as a large Fraunces numeral, the student's live status (answered / correct-wrong), and the explanation. The Phase-1 tool row (Draw/Highlight/Go-to/Reveal) is rendered **disabled** with a "Phase 2" affordance so the layout is final but the actions are inert. Correct answer + explanation are passed in as props (fetched by the page in Task 15 via the existing tutor question endpoint).

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/live/TutorLivePanel.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import TutorLivePanel from './TutorLivePanel';

const baseProps = {
  correctAnswerLabel: 'C · x = 10',
  explanationHtml: '<p>Distribute the 3.</p>',
  studentStatus: { answered: true, correct: false, selectedLabel: 'B' },
};

test('starts expanded and shows correct answer + explanation', () => {
  render(<TutorLivePanel {...baseProps} />);
  expect(screen.getByText('C · x = 10')).toBeInTheDocument();
  expect(screen.getByText(/Distribute the 3/)).toBeInTheDocument();
});

test('collapses when the toggle is clicked', () => {
  render(<TutorLivePanel {...baseProps} />);
  fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
  expect(screen.queryByText('C · x = 10')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
});

test('shows wrong-answer status when student answered incorrectly', () => {
  render(<TutorLivePanel {...baseProps} />);
  expect(screen.getByText(/answered B/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/components/live/TutorLivePanel.test.js`
Expected: FAIL — Cannot find module './TutorLivePanel'

- [ ] **Step 3: Write minimal implementation**

```jsx
// frontend/src/components/live/TutorLivePanel.jsx
import React, { useState } from 'react';

/**
 * Collapsible coaching sidebar for the tutor's live view. Starts expanded;
 * collapses to a thin rail so the tutor can see exactly what the student sees.
 * Study Hall: big Fraunces answer numeral, hairline rules, warm amber accent.
 *
 * Phase 1 is observe-only, so the tool row is rendered disabled. Phase 2 wires
 * Draw / Highlight / Go-to-question / Reveal.
 */
export default function TutorLivePanel({
  correctAnswerLabel,
  explanationHtml,
  studentStatus = {},
}) {
  const [expanded, setExpanded] = useState(true);
  const { answered, correct, selectedLabel } = studentStatus;

  if (!expanded) {
    return (
      <div className="flex w-12 flex-col items-center border-l border-edge bg-surface-soft pt-4">
        <button
          type="button"
          aria-label="Expand coach panel"
          onClick={() => setExpanded(true)}
          className="text-brand-600 [writing-mode:vertical-rl] rotate-180 text-xs font-semibold"
        >
          ▶ COACH PANEL
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-72 flex-col gap-4 border-l border-edge bg-surface-soft p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Correct answer
        </span>
        <button
          type="button"
          aria-label="Collapse coach panel"
          onClick={() => setExpanded(false)}
          className="text-xs text-ink-soft hover:text-ink"
        >
          Collapse ▶
        </button>
      </div>

      <div className="font-display text-3xl leading-none text-accent-700">
        {correctAnswerLabel}
      </div>

      {answered && (
        <div className="border-t border-edge pt-3 text-sm font-semibold">
          {correct ? (
            <span className="text-accent-700">✓ Student answered correctly</span>
          ) : (
            <span className="text-danger-600">
              ✕ Student answered {selectedLabel} (incorrect)
            </span>
          )}
        </div>
      )}

      <div className="border-t border-edge pt-3">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Explanation
        </div>
        <div
          className="prose prose-sm text-ink"
          dangerouslySetInnerHTML={{ __html: explanationHtml || '' }}
        />
      </div>

      <div className="mt-auto flex flex-wrap gap-2 opacity-50" title="Available in Phase 2">
        {['Draw', 'Highlight', 'Go to Q…', 'Reveal to student'].map((t) => (
          <span key={t} className="rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink">
            {t}
          </span>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx jest src/components/live/TutorLivePanel.test.js`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/live/TutorLivePanel.jsx frontend/src/components/live/TutorLivePanel.test.js frontend/src/components/live/index.js
git commit -m "feat(live): add collapsible TutorLivePanel coach sidebar"
```

---

## Task 14: Student side — emit deltas + show indicator

**Files:**
- Modify: `frontend/src/components/test/ModuleTestInterface.jsx`
- Test: `frontend/src/components/test/ModuleTestInterface.live.test.js`

Wire the student's existing test interface to (optionally) emit live deltas and show the `LiveIndicator`. Gated by a `live` prop object `{ enabled, sessionId }` so non-live surfaces are unaffected. When enabled: use `useLiveSession` as a student, emit `question_changed` when `currentIndex` changes and `answer_selected` in the existing `handleAnswerSelect`, show `LiveIndicator` when a `tutor_joined` message has been seen (and hide on `tutor_left`), and re-send the current `stroke_batch` when `tutor_joined` arrives.

Because `ModuleTestInterface` is large, keep the change surgical: add the hook call near the other hooks, add two `useEffect`/callback emissions, and render `<LiveIndicator>` in the header area.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/test/ModuleTestInterface.live.test.js
import { computeLiveIndicatorState } from './liveHelpers';

// Pure helper extracted so the emit/indicator logic is unit-testable without
// mounting the whole heavy interface.
test('tutor_joined sets present true, tutor_left sets it false', () => {
  let state = computeLiveIndicatorState({}, { type: 'tutor_joined', payload: {} });
  expect(state.present).toBe(true);
  state = computeLiveIndicatorState(state, { type: 'tutor_left', payload: {} });
  expect(state.present).toBe(false);
});

test('ignores unrelated message types', () => {
  const state = computeLiveIndicatorState({ present: true }, { type: 'answer_selected' });
  expect(state.present).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/components/test/ModuleTestInterface.live.test.js`
Expected: FAIL — Cannot find module './liveHelpers'

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/test/liveHelpers.js`:

```javascript
/** Reduce a live message into indicator state {present, tutorName}. */
export function computeLiveIndicatorState(prev, msg) {
  if (!msg || !msg.type) return prev;
  if (msg.type === 'tutor_joined') {
    return { present: true, tutorName: (msg.payload && msg.payload.tutor_name) || null };
  }
  if (msg.type === 'tutor_left') {
    return { present: false, tutorName: null };
  }
  return prev;
}
```

Then wire `ModuleTestInterface.jsx`. Add near the top imports:

```javascript
import useLiveSession from '../../hooks/useLiveSession';
import { LiveIndicator } from '../live';
import { computeLiveIndicatorState } from './liveHelpers';
```

Add a prop with a default (find the component signature, ~line 19) — add `live = { enabled: false }` to the destructured props.

Add hook usage near the other `useState`/hooks:

```javascript
  const { status: liveStatus, lastByType, send: liveSend } = useLiveSession({
    sessionId: live?.sessionId,
    role: 'student',
    enabled: !!live?.enabled,
  });
  const [liveIndicator, setLiveIndicator] = useState({ present: false, tutorName: null });

  // Update indicator + re-send current strokes when a tutor joins.
  useEffect(() => {
    const joined = lastByType?.tutor_joined;
    const left = lastByType?.tutor_left;
    const latest = [joined, left].filter(Boolean).sort(
      (a, b) => (b?._rx || 0) - (a?._rx || 0)
    )[0];
    if (latest) setLiveIndicator((prev) => computeLiveIndicatorState(prev, latest));
  }, [lastByType]);
```

In the existing `handleAnswerSelect(questionId, answer)` (~line 91), after the local `setAnswers`, add:

```javascript
    if (live?.enabled) {
      liveSend({ type: 'answer_selected', session_id: live.sessionId,
        sender_role: 'student', seq: 0,
        payload: { question_id: questionId, selected_answer: answer } });
    }
```

Add an effect emitting `question_changed` when `currentIndex` changes:

```javascript
  useEffect(() => {
    if (!live?.enabled) return;
    const q = questions[currentIndex];
    if (!q) return;
    liveSend({ type: 'question_changed', session_id: live.sessionId,
      sender_role: 'student', seq: 0,
      payload: { question_index: currentIndex, question_id: q.id } });
  }, [currentIndex, live, questions, liveSend]);
```

Render the indicator in the header (near where `TestHeader` is rendered):

```jsx
      {live?.enabled && <LiveIndicator present={liveIndicator.present} tutorName={liveIndicator.tutorName} />}
```

Note on `_rx`: to order joined/left messages, stamp received messages in the hook. In `useLiveSession.js` `handleMessage`, change the stored value to include an increment counter instead of a timestamp (timestamps aren't needed): keep a ref counter and set `msg._rx = ++counter` before storing. Add in the hook:

```javascript
  const rxCounter = useRef(0);
  // inside handleMessage, before setLastByType:
  msg._rx = ++rxCounter.current;
```

- [ ] **Step 4: Run tests + build**

Run: `cd frontend && CI=true npx jest src/components/test/ModuleTestInterface.live.test.js`
Expected: PASS (2 passed)

Run: `cd frontend && CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/test/liveHelpers.js frontend/src/components/test/ModuleTestInterface.jsx frontend/src/components/test/ModuleTestInterface.live.test.js frontend/src/hooks/useLiveSession.js
git commit -m "feat(live): student emits live deltas + shows tutor indicator"
```

---

## Task 15: Student side — stream strokes to the room

**Files:**
- Modify: `frontend/src/components/test/DrawingCanvas.jsx`
- Test: covered by manual/E2E (Task 18); add a focused helper test.

`DrawingCanvas` accepts an optional `onStrokeBatch(questionId, strokes)` callback, invoked on stroke-completion (pointer-up) and re-sendable. `ModuleTestInterface` passes a callback that wraps `liveSend` with a `stroke_batch` message, and also triggers a re-send when `tutor_joined` arrives.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/test/drawingBatch.test.js
import { buildStrokeBatchMessage } from './liveHelpers';

test('builds a stroke_batch message from strokes', () => {
  const msg = buildStrokeBatchMessage('sess-1', 'q-1', [{ color: '#000', size: 3, eraser: false, points: [] }]);
  expect(msg.type).toBe('stroke_batch');
  expect(msg.session_id).toBe('sess-1');
  expect(msg.payload.question_id).toBe('q-1');
  expect(msg.payload.strokes).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/components/test/drawingBatch.test.js`
Expected: FAIL — `buildStrokeBatchMessage` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `frontend/src/components/test/liveHelpers.js`:

```javascript
/** Build a stroke_batch live message. */
export function buildStrokeBatchMessage(sessionId, questionId, strokes) {
  return {
    type: 'stroke_batch',
    session_id: sessionId,
    sender_role: 'student',
    seq: 0,
    payload: { question_id: questionId, strokes: strokes || [] },
  };
}
```

In `DrawingCanvas.jsx`, add an optional prop `onStrokeBatch` and call it at the end of the pointer-up handler (where a completed stroke is pushed to the question's stroke array):

```javascript
    // after committing the finished stroke to strokesMap for currentQuestionId:
    if (typeof onStrokeBatch === 'function') {
      onStrokeBatch(currentQuestionId, strokesMap.get(currentQuestionId) || []);
    }
```

In `ModuleTestInterface.jsx`, pass the callback to the `DrawingCanvas` (found where `<DrawingCanvas .../>` is rendered, gated by `isDrawing`):

```jsx
    onStrokeBatch={live?.enabled ? (qid, strokes) => liveSend(buildStrokeBatchMessage(live.sessionId, qid, strokes)) : undefined}
```

Import the helper at the top of `ModuleTestInterface.jsx`:

```javascript
import { computeLiveIndicatorState, buildStrokeBatchMessage } from './liveHelpers';
```

And re-send strokes on tutor join — extend the `tutor_joined` effect from Task 14 to also emit the current question's batch (the current strokes are held in `DrawingCanvas`; simplest is to lift the latest batch into a ref updated by `onStrokeBatch`). Add a ref:

```javascript
  const lastStrokeBatchRef = useRef({ questionId: null, strokes: [] });
```

Update the callback to also record:

```jsx
    onStrokeBatch={live?.enabled ? (qid, strokes) => {
      lastStrokeBatchRef.current = { questionId: qid, strokes };
      liveSend(buildStrokeBatchMessage(live.sessionId, qid, strokes));
    } : undefined}
```

In the `tutor_joined` branch, re-send:

```javascript
    if (latest && latest.type === 'tutor_joined' && live?.enabled) {
      const { questionId, strokes } = lastStrokeBatchRef.current;
      if (questionId) liveSend(buildStrokeBatchMessage(live.sessionId, questionId, strokes));
    }
```

- [ ] **Step 4: Run tests + build**

Run: `cd frontend && CI=true npx jest src/components/test/drawingBatch.test.js`
Expected: PASS (1 passed)

Run: `cd frontend && CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/test/DrawingCanvas.jsx frontend/src/components/test/ModuleTestInterface.jsx frontend/src/components/test/liveHelpers.js frontend/src/components/test/drawingBatch.test.js
git commit -m "feat(live): stream student stroke batches to the live room"
```

---

## Task 16: tutorService.getActiveSessions

**Files:**
- Modify: `frontend/src/services/tutorService.js`
- Test: `frontend/src/services/tutorService.live.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/services/tutorService.live.test.js
import tutorService from './tutorService';
import api from './api';

jest.mock('./api', () => ({ get: jest.fn(() => Promise.resolve({ data: { sessions: [] } })) }));

test('getActiveSessions calls the live/active endpoint', async () => {
  await tutorService.getActiveSessions();
  expect(api.get).toHaveBeenCalledWith('/live/active');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/services/tutorService.live.test.js`
Expected: FAIL — `getActiveSessions is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to the `tutorService` object in `frontend/src/services/tutorService.js`:

```javascript
  getActiveSessions: () => api.get('/live/active'),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx jest src/services/tutorService.live.test.js`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/tutorService.js frontend/src/services/tutorService.live.test.js
git commit -m "feat(live): add tutorService.getActiveSessions"
```

---

## Task 17: LiveSessionsPage + watch view + routes

**Files:**
- Create: `frontend/src/pages/tutor/LiveSessionsPage.jsx`
- Modify: `frontend/src/App.js` (add routes)
- Test: `frontend/src/pages/tutor/LiveSessionsPage.test.js`

The page has two modes driven by the route: a **list** of active sessions (`/tutor/live`) and a **watch view** (`/tutor/live/:sessionId`). The watch view uses `useLiveSession` as a tutor, renders the student's current question read-only (reusing `ModuleTestInterface` in spectator mode — a follow-on refinement; for Phase 1 the watch view renders the question prompt + choices from the snapshot/deltas and docks `TutorLivePanel`), overlays `LiveStrokeLayer` with the latest `stroke_batch`, and fetches the correct answer + explanation for the current question via the existing tutor question endpoint.

Keep this task focused on the list + wiring; the read-only rendering reuses existing display components.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/pages/tutor/LiveSessionsPage.test.js
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveSessionsPage from './LiveSessionsPage';
import tutorService from '../../services/tutorService';

jest.mock('../../services/tutorService', () => ({
  __esModule: true,
  default: { getActiveSessions: jest.fn() },
}));

test('lists active sessions returned by the API', async () => {
  tutorService.getActiveSessions.mockResolvedValue({
    data: { sessions: [
      { session_id: 's-1', student_id: 'u-1', student_name: 'Maya R.', test_type: 'PRACTICE' },
    ] },
  });
  render(<MemoryRouter><LiveSessionsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Maya R.')).toBeInTheDocument());
});

test('shows empty state when no one is active', async () => {
  tutorService.getActiveSessions.mockResolvedValue({ data: { sessions: [] } });
  render(<MemoryRouter><LiveSessionsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/no active sessions/i)).toBeInTheDocument());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/pages/tutor/LiveSessionsPage.test.js`
Expected: FAIL — Cannot find module './LiveSessionsPage'

- [ ] **Step 3: Write minimal implementation**

```jsx
// frontend/src/pages/tutor/LiveSessionsPage.jsx
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import tutorService from '../../services/tutorService';

/**
 * Tutor live sessions. Without :sessionId, shows the list of students who are
 * active right now. With :sessionId, shows the live watch view. Poll the list
 * lightly (every 5s) since room membership changes are infrequent.
 */
export default function LiveSessionsPage() {
  const { sessionId } = useParams();
  if (sessionId) return <LiveWatchView sessionId={sessionId} />;
  return <LiveSessionsList />;
}

function LiveSessionsList() {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await tutorService.getActiveSessions();
        if (active) setSessions(data.sessions);
      } catch (_) {
        if (active) setSessions([]);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (sessions === null) return <div className="p-6 text-ink-soft">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl text-ink">Live now</h1>
      <p className="mb-6 text-sm text-ink-soft">Students working right now. Join to watch and coach.</p>
      {sessions.length === 0 ? (
        <div className="rounded-lg border border-edge bg-surface-soft p-8 text-center text-ink-soft">
          No active sessions right now.
        </div>
      ) : (
        <ul className="divide-y divide-edge">
          {sessions.map((s) => (
            <li key={s.session_id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold text-ink">{s.student_name}</div>
                <div className="text-xs text-ink-soft">{s.test_type}</div>
              </div>
              <Link
                to={`/tutor/live/${s.session_id}`}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Join live
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LiveWatchView({ sessionId }) {
  // Minimal Phase-1 watch view: shell that will render the student's current
  // question read-only + TutorLivePanel. Full read-only question rendering is a
  // follow-on within this task's scope; the shell + live wiring land here.
  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <Link to="/tutor/live" className="text-sm text-brand-600">← Back to live</Link>
        <div className="mt-4 text-ink-soft">Watching session {sessionId}…</div>
      </div>
    </div>
  );
}
```

Add routes in `frontend/src/App.js` inside the tutor `AuthGuard` block (near the other `/tutor/*` routes):

```jsx
        <Route path="/tutor/live" element={<LiveSessionsPage />} />
        <Route path="/tutor/live/:sessionId" element={<LiveSessionsPage />} />
```

And the import near the other tutor page imports:

```javascript
import LiveSessionsPage from './pages/tutor/LiveSessionsPage';
```

- [ ] **Step 4: Run tests + build**

Run: `cd frontend && CI=true npx jest src/pages/tutor/LiveSessionsPage.test.js`
Expected: PASS (2 passed)

Run: `cd frontend && CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tutor/LiveSessionsPage.jsx frontend/src/App.js
git commit -m "feat(live): add tutor live-sessions list + watch view shell + routes"
```

---

## Task 18: Backend — tutor question-detail endpoint (answer + explanation)

**Files:**
- Modify: `backend/app/api/v1/live.py` (add `GET /live/question/{question_id}`)
- Test: `backend/app/tests/test_live_api.py` (add test)

The tutor watch view needs the correct answer + explanation for whatever question the student is on. There is no existing tutor-scoped question-detail endpoint (verified: `GET /questions/{id}` returns `QuestionDetail` but the panel needs a compact `{prompt_html, stimulus_html, choices, correct_answer_json, explanation_html}` shape, and this should be tutor-gated). Add it to the live router since it's part of this feature. `Question` fields confirmed in the model: `prompt_html`, `stimulus_html`, `choices_json`, `answer_type`, `correct_answer_json`, `explanation_html`.

- [ ] **Step 1: Write the failing test (append to test_live_api.py)**

```python
def test_tutor_question_detail_returns_answer_and_explanation(client, db):
    from uuid import uuid4
    from app.models.question import Question
    from app.models.enums import AnswerType

    tutor = _mk_user(db, UserRole.TUTOR)
    q = Question(
        id=uuid4(),
        external_id="q-live-1",
        prompt_html="<p>Solve 3(x-2)=2x+4</p>",
        stimulus_html=None,
        choices_json=["x=6", "x=8", "x=10", "x=12"],
        answer_type=AnswerType.MCQ,
        correct_answer_json={"index": 2},
        explanation_html="<p>Distribute the 3.</p>",
        is_active=True,
    )
    db.add(q)
    db.commit()

    r = client.get(f"/api/v1/live/question/{q.id}", headers=_auth(tutor))
    assert r.status_code == 200
    body = r.json()
    assert body["correct_answer_json"] == {"index": 2}
    assert "Distribute" in body["explanation_html"]
    assert body["choices"] == ["x=6", "x=8", "x=10", "x=12"]


def test_tutor_question_detail_requires_tutor(client, db):
    from uuid import uuid4
    student = _mk_user(db, UserRole.STUDENT)
    r = client.get(f"/api/v1/live/question/{uuid4()}", headers=_auth(student))
    assert r.status_code == 403
```

Note: check the actual `Question` field names before running (open `backend/app/models/question.py`). If a field differs (e.g. choices stored under a different attribute), adjust the test fixture and the endpoint together. The test is the contract; make them match reality.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest app/tests/test_live_api.py::test_tutor_question_detail_returns_answer_and_explanation -v`
Expected: FAIL — 404 (no `/live/question/{id}` route).

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app/api/v1/live.py`:

```python
from app.api.deps import get_current_tutor
from app.models.question import Question


class LiveQuestionDetail(BaseModel):
    question_id: str
    prompt_html: str | None = None
    stimulus_html: str | None = None
    choices: list = []
    answer_type: str
    correct_answer_json: dict | list | None = None
    explanation_html: str | None = None


@router.get("/live/question/{question_id}", response_model=LiveQuestionDetail, tags=["Live Session"])
def live_question_detail(
    question_id: UUID,
    db: Session = Depends(get_db),
    tutor: User = Depends(get_current_tutor),
) -> LiveQuestionDetail:
    q = db.query(Question).filter(Question.id == question_id).first()
    if q is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return LiveQuestionDetail(
        question_id=str(q.id),
        prompt_html=q.prompt_html,
        stimulus_html=q.stimulus_html,
        choices=q.choices_json or [],
        answer_type=q.answer_type.value if hasattr(q.answer_type, "value") else str(q.answer_type),
        correct_answer_json=q.correct_answer_json,
        explanation_html=q.explanation_html,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest app/tests/test_live_api.py -v`
Expected: PASS (all in file)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/live.py backend/app/tests/test_live_api.py
git commit -m "feat(live): add tutor question-detail endpoint for the coach panel"
```

---

## Task 19: Frontend — liveService question-detail + answer-label helper

**Files:**
- Modify: `frontend/src/services/liveService.js` (add `getQuestionDetail`)
- Create/Modify: `frontend/src/components/live/liveFormat.js` (answer-label helper)
- Test: `frontend/src/components/live/liveFormat.test.js`

The panel shows the correct answer as a letter+text label (e.g. "C · x = 10"). Build a pure helper that turns `{correct_answer_json, choices, answer_type}` into that label, and add the service call.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/components/live/liveFormat.test.js
import { correctAnswerLabel, correctIndex } from './liveFormat';

test('MCQ index -> letter + choice text', () => {
  const detail = { answer_type: 'MCQ', correct_answer_json: { index: 2 }, choices: ['6', '8', '10', '12'] };
  expect(correctAnswerLabel(detail)).toBe('C · 10');
  expect(correctIndex(detail)).toBe(2);
});

test('SPR answers -> joined string', () => {
  const detail = { answer_type: 'SPR', correct_answer_json: { answers: ['3/4', '0.75'] }, choices: [] };
  expect(correctAnswerLabel(detail)).toBe('3/4 or 0.75');
  expect(correctIndex(detail)).toBe(null);
});

test('missing detail -> em dash', () => {
  expect(correctAnswerLabel(null)).toBe('—');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && CI=true npx jest src/components/live/liveFormat.test.js`
Expected: FAIL — Cannot find module './liveFormat'

- [ ] **Step 3: Write minimal implementation**

```javascript
// frontend/src/components/live/liveFormat.js
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** For MCQ, the correct choice index; null for SPR/unknown. */
export function correctIndex(detail) {
  if (!detail || detail.answer_type !== 'MCQ') return null;
  const idx = detail.correct_answer_json?.index;
  return typeof idx === 'number' ? idx : null;
}

/** Human label for the correct answer, e.g. "C · 10" or "3/4 or 0.75". */
export function correctAnswerLabel(detail) {
  if (!detail) return '—';
  if (detail.answer_type === 'MCQ') {
    const idx = correctIndex(detail);
    if (idx == null) return '—';
    const text = (detail.choices && detail.choices[idx]) || '';
    return `${LETTERS[idx] || '?'} · ${String(text).replace(/<[^>]+>/g, '').trim()}`;
  }
  const answers = detail.correct_answer_json?.answers || [];
  return answers.length ? answers.join(' or ') : '—';
}
```

Add to `frontend/src/services/liveService.js` (inside the exported object and as a named export):

```javascript
export function getQuestionDetail(questionId) {
  return api.get(`/live/question/${questionId}`);
}
// add getQuestionDetail to the default export object too
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && CI=true npx jest src/components/live/liveFormat.test.js`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/live/liveFormat.js frontend/src/components/live/liveFormat.test.js frontend/src/services/liveService.js
git commit -m "feat(live): add correct-answer label helper + question-detail service"
```

---

## Task 20: Wire the watch view rendering + student session enablement + E2E

**Files:**
- Modify: `frontend/src/pages/tutor/LiveSessionsPage.jsx` (`LiveWatchView` full render)
- Modify: the student surfaces that mount `ModuleTestInterface` to pass `live={{ enabled: true, sessionId }}` (question bank / assignment / adaptive taking pages)
- Test: manual two-browser E2E

This task completes the observe loop: the watch view subscribes via `useLiveSession` (tutor), tracks the current question from `snapshot`/`question_changed`, renders the question read-only using the real `QuestionDisplay` (which renders only the prompt/stimulus — non-interactive by nature) plus a read-only choices list, docks `TutorLivePanel` (correct answer + explanation from Task 18's endpoint), and overlays `LiveStrokeLayer` from the latest `stroke_batch`. Student taking-pages opt in by passing the `live` prop.

- [ ] **Step 1: Implement the watch view render**

Replace `LiveWatchView` in `LiveSessionsPage.jsx`. Uses the REAL `QuestionDisplay` prop names (`questionNumber`, `questionHtml`, `stimulusHtml`, `questionId`, `hideMarkForReview`) verified against the component:

```jsx
import useLiveSession from '../../hooks/useLiveSession';
import { TutorLivePanel, LiveStrokeLayer } from '../../components/live';
import { correctAnswerLabel, correctIndex } from '../../components/live/liveFormat';
import { getQuestionDetail } from '../../services/liveService';
import QuestionDisplay from '../../components/test/QuestionDisplay';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function LiveWatchView({ sessionId }) {
  const { status, snapshot, lastByType } = useLiveSession({
    sessionId, role: 'tutor', enabled: true,
  });

  const qChanged = lastByType?.question_changed?.payload;
  const answer = lastByType?.answer_selected?.payload || (snapshot ? {
    question_id: snapshot.question_id, selected_answer: snapshot.selected_answer,
  } : null);
  const strokeBatch = lastByType?.stroke_batch?.payload;
  const currentQuestionId = qChanged?.question_id || snapshot?.question_id || null;

  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!currentQuestionId) { setDetail(null); return; }
    let active = true;
    getQuestionDetail(currentQuestionId)
      .then((r) => { if (active) setDetail(r.data); })
      .catch(() => { if (active) setDetail(null); });
    return () => { active = false; };
  }, [currentQuestionId]);

  const selected = answer?.selected_answer;
  // For MCQ, selected_answer is the chosen index.
  const selectedIdx = typeof selected === 'number' ? selected : null;

  return (
    <div className="flex h-full">
      <div className="relative flex-1 overflow-auto p-6">
        <Link to="/tutor/live" className="text-sm text-brand-600">← Back to live</Link>
        <div className="mb-2 mt-2 text-xs text-ink-soft">
          {status === 'connected' ? 'Live' : 'Reconnecting…'}
        </div>
        {detail ? (
          <>
            <QuestionDisplay
              questionNumber={(qChanged?.question_index ?? snapshot?.question_index ?? 0) + 1}
              questionHtml={detail.prompt_html}
              stimulusHtml={detail.stimulus_html}
              questionId={detail.question_id}
              hideMarkForReview
              onReport={() => {}}
            />
            {detail.answer_type === 'MCQ' && (
              <ul className="mt-4 space-y-2 px-6">
                {(detail.choices || []).map((c, i) => {
                  const isPicked = selectedIdx === i;
                  const isCorrect = correctIndex(detail) === i;
                  return (
                    <li
                      key={i}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        isCorrect ? 'border-accent-600' : isPicked ? 'border-danger-500 bg-danger-50' : 'border-edge'
                      }`}
                      dangerouslySetInnerHTML={{ __html: `<strong>${LETTERS[i]}.</strong> ${c}${isPicked ? ' — student picked' : ''}${isCorrect ? ' — correct' : ''}` }}
                    />
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <div className="text-ink-soft">Waiting for the student’s current question…</div>
        )}
        <LiveStrokeLayer strokes={strokeBatch?.strokes} width={1000} height={1400} />
      </div>
      <TutorLivePanel
        correctAnswerLabel={correctAnswerLabel(detail)}
        explanationHtml={detail?.explanation_html || ''}
        studentStatus={{
          answered: selected != null,
          correct: detail && selectedIdx != null ? correctIndex(detail) === selectedIdx : false,
          selectedLabel: selectedIdx != null ? LETTERS[selectedIdx] : selected,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Enable live on student taking-pages**

For each student surface that renders `ModuleTestInterface` (question bank practice, assignment taking, adaptive practice), pass the `live` prop. Example for the practice/assignment taking page (find where `<ModuleTestInterface module={...} />` is used):

```jsx
<ModuleTestInterface
  module={module}
  live={{ enabled: true, sessionId: module.test_session_id }}
  /* ...existing props... */
/>
```

- [ ] **Step 3: Build**

Run: `cd frontend && CI=true npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual two-browser E2E (acceptance check)**

1. Start backend (`cd backend && uvicorn app.main:app --reload`) and frontend (`cd frontend && npm start`).
2. Browser A: log in as a student, start a question-bank/practice session, answer a question, open the drawing tool and draw.
3. Browser B: log in as that student's tutor, go to `/tutor/live`, confirm the student appears, click "Join live".
4. Verify on the tutor screen: the current question renders, the student's selected answer shows, the drawing appears, and `TutorLivePanel` shows the correct answer + explanation. Change questions as the student → tutor view follows.
5. Verify on the student screen: the `LiveIndicator` ("your tutor is here") appears when the tutor joins and disappears when the tutor closes the tab.
6. Kill the tutor tab mid-session → student's test continues unaffected; reopen → snapshot restores the view.

Record pass/fail for each step. Fix and re-run before completing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/tutor/LiveSessionsPage.jsx frontend/src/pages/student/ frontend/src/services/tutorService.js
git commit -m "feat(live): complete tutor watch view + enable live on student sessions"
```

---

## Task 21: Full test sweep + docs

**Files:**
- Modify: `README.md` (add Live Session to features + endpoints)
- Modify: `docs/CODEBASE_ORGANIZATION.md` (note new files)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: all pass (including pre-existing tests).

- [ ] **Step 2: Run the full frontend suite + build**

Run: `cd frontend && CI=true npm test -- --watchAll=false`
Then: `cd frontend && CI=true npm run build`
Expected: tests pass, build succeeds (per the Vercel CI-strict rule).

- [ ] **Step 3: Update README**

Add under Features:
```
- **Live Tutor Sessions**: Tutors watch a student's in-progress session in real time (current question, selected answer, live drawing) with a coaching sidebar showing the correct answer + explanation. WebSocket-based; observe-only in Phase 1.
```
Add under API Endpoints → a new "Live Session" group:
```
- `POST /api/v1/live/token` - Mint a short-lived WS ticket for a session
- `GET  /api/v1/live/active` - List the tutor's students who are live now
- `GET  /api/v1/live/question/{question_id}` - Tutor question detail (answer + explanation)
- `WS   /api/v1/live/ws/{session_id}` - Live room connection
```

- [ ] **Step 4: Update CODEBASE_ORGANIZATION.md**

Note the new backend files (`api/v1/live.py`, `services/live_room_manager.py`, `core/live_ticket.py`, `schemas/live.py`) and frontend files (`components/live/`, `hooks/useLiveSession.js`, `services/liveService.js`, `pages/tutor/LiveSessionsPage.jsx`).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/CODEBASE_ORGANIZATION.md
git commit -m "docs: document live tutor session feature"
```

---

## Self-Review Notes

- **Spec coverage:** transport (Tasks 1-8), student indicator (12,14), student delta/stroke emission (14,15), read-only stroke view (12,20), coaching sidebar with answer+explanation (13,18,19,20), live-sessions list (6,16,17), snapshot-on-join (8), reconnect/backoff (11), auth via ticket + ownership (1,5,7), no Redis / no new tables (enforced in task notes). Phase-2 items are explicitly rendered inert (13) or omitted.
- **Type consistency:** stroke shape `{color,size,eraser,points:[{x,y}]}` used in Tasks 9,12,15; message envelope `{type,session_id,sender_role,seq,payload}` used in Tasks 2,7,10,11,14,15; `renderStrokes` name consistent 9/12; `getActiveSessions`/`/live/active` consistent 6/16; `getQuestionDetail`/`/live/question/{id}` consistent 18,19,20.
- **Verified against real code (fixed during review):** `QuestionDisplay` takes `questionNumber`/`questionHtml`/`stimulusHtml`/`questionId`/`hideMarkForReview` (not a `question` object or `readOnly`) — Task 20 uses the real props and renders choices separately since `QuestionDisplay` only renders the prompt. No pre-existing tutor question-detail endpoint returns the correct answer, so Task 18 adds a tutor-gated `GET /live/question/{id}`. JWT ticket reuses `python-jose` + `settings.secret_key` per `app/core/security.py`. WS tests use `TestClient.websocket_connect` per the FastAPI test setup.
- **Task count:** 21 tasks. Numbering is contiguous 1-21.
