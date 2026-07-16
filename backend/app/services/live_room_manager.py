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
        # Last student message of each cached type, replayed to a joining tutor
        # so a mid-session joiner sees current state without waiting for the
        # student to re-emit (avoids a join race).
        self.cache: Dict[str, dict] = {}

    def is_empty(self) -> bool:
        return self.student is None and not self.tutors


class LiveRoomManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, Room] = {}
        self._used_tickets: Set[str] = set()

    def room_exists(self, session_id: str) -> bool:
        return session_id in self._rooms

    def student_present(self, session_id: str) -> bool:
        room = self._rooms.get(session_id)
        return room is not None and room.student is not None

    def tutor_count(self, session_id: str) -> int:
        room = self._rooms.get(session_id)
        return len(room.tutors) if room else 0

    def active_student_session_ids(self) -> list:
        """Session ids that currently have a connected student."""
        return [sid for sid, room in self._rooms.items() if room.student is not None]

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

    def consume_ticket(self, jti: str) -> bool:
        """Return True the first time a jti is seen, False afterward."""
        if jti in self._used_tickets:
            return False
        self._used_tickets.add(jti)
        return True

    # Student message types whose latest value is cached + replayed on tutor join.
    _CACHED_TYPES = ("question_changed", "answer_selected")

    def cache_student_message(self, session_id: str, message: dict) -> None:
        """Remember the latest cacheable student message for replay on join."""
        room = self._rooms.get(session_id)
        if room is None:
            return
        mtype = message.get("type")
        if mtype in self._CACHED_TYPES:
            room.cache[mtype] = message
            # A new question invalidates the previous answer so a stale answer
            # is never replayed onto a freshly-navigated question.
            if mtype == "question_changed":
                room.cache.pop("answer_selected", None)

    async def replay_cache_to(self, session_id: str, conn: LiveConnection) -> None:
        """Send a joining tutor the room's cached student state, if any."""
        room = self._rooms.get(session_id)
        if room is None:
            return
        for mtype in self._CACHED_TYPES:
            msg = room.cache.get(mtype)
            if msg is not None:
                await conn.send_json(msg)

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
