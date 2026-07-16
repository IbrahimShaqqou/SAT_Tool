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


def test_jti_is_unique_across_tickets():
    tokens = [create_live_ticket(user_id="u-1", session_id="s-1", role="tutor") for _ in range(3)]
    jtis = [decode_live_ticket(t)["jti"] for t in tokens]
    assert len(set(jtis)) == 3
