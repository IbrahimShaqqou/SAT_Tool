"""Tests for live WebSocket message schemas."""

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


def test_shared_drawing_message_types_valid():
    from app.schemas.live import LiveMessage
    for t in ["stroke_start", "stroke_points", "stroke_end", "stroke_undo", "stroke_clear", "strokes_sync", "viewport"]:
        msg = LiveMessage(type=t, session_id="s-1", sender_role="tutor", seq=0, payload={})
        assert msg.type == t
