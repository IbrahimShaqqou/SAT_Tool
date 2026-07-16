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
    # Phase 2: shared live drawing
    "stroke_start",
    "stroke_points",
    "stroke_end",
    "stroke_undo",
    "stroke_clear",
    "strokes_sync",
    "viewport",
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
