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
    """Return ticket claims if valid, unexpired, and of type 'live_ticket', else None."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError:
        return None
    if payload.get("type") != "live_ticket":
        return None
    if "jti" not in payload:
        return None
    return payload
