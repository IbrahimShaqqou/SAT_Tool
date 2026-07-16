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
