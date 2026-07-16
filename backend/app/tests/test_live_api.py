"""Tests for the live-session REST + WebSocket endpoints."""

import time
from uuid import uuid4

import pytest

from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.enums import UserRole, TestType, TestStatus
from app.models.test import TestSession


def _mk_user(db, role, tutor_id=None):
    user = User(
        id=uuid4(),
        email=f"{uuid4().hex[:8]}@ex.com",
        password_hash=get_password_hash("Passw0rd!"),
        first_name="X",
        last_name="Y",
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


def test_admin_gets_ticket_for_any_session(client, db):
    admin = _mk_user(db, UserRole.ADMIN)
    student = _mk_user(db, UserRole.STUDENT)  # not related to admin
    session = _mk_session(db, student.id)
    r = client.post(
        "/api/v1/live/token",
        json={"session_id": str(session.id)},
        headers=_auth(admin),
    )
    assert r.status_code == 200


def test_malformed_session_id_returns_404(client, db):
    student = _mk_user(db, UserRole.STUDENT)
    r = client.post(
        "/api/v1/live/token",
        json={"session_id": "not-a-uuid"},
        headers=_auth(student),
    )
    assert r.status_code == 404


def test_active_sessions_lists_only_rooms_with_connected_student(client, db):
    import asyncio
    from app.api.v1.live import room_manager

    # clean slate
    room_manager._rooms.clear()

    tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=tutor.id)
    session = _mk_session(db, student.id)

    class _Fake:
        async def send_json(self, d):
            pass

    asyncio.run(room_manager.join(str(session.id), role="student", conn=_Fake()))

    try:
        r = client.get("/api/v1/live/active", headers=_auth(tutor))
        assert r.status_code == 200
        items = r.json()["sessions"]
        assert any(s["session_id"] == str(session.id) for s in items)
        match = [s for s in items if s["session_id"] == str(session.id)][0]
        assert match["student_name"] == student.full_name
    finally:
        room_manager._rooms.clear()


def test_active_sessions_excludes_other_tutors_students(client, db):
    import asyncio
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()

    tutor = _mk_user(db, UserRole.TUTOR)
    other_tutor = _mk_user(db, UserRole.TUTOR)
    student = _mk_user(db, UserRole.STUDENT, tutor_id=other_tutor.id)
    session = _mk_session(db, student.id)

    class _Fake:
        async def send_json(self, d):
            pass

    asyncio.run(room_manager.join(str(session.id), role="student", conn=_Fake()))
    try:
        r = client.get("/api/v1/live/active", headers=_auth(tutor))
        assert r.status_code == 200
        ids = [s["session_id"] for s in r.json()["sessions"]]
        assert str(session.id) not in ids  # belongs to other_tutor's student
    finally:
        room_manager._rooms.clear()


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
        s_ws.send_json({"type": "presence", "session_id": sid,
                        "sender_role": "student", "seq": 1,
                        "payload": {"status": "active", "surface": "practice"}})

        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            # The joining tutor first receives a state snapshot.
            snap = t_ws.receive_json()
            assert snap["type"] == "snapshot"

            joined = s_ws.receive_json()
            assert joined["type"] == "tutor_joined"

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
    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={ticket}"):
            pass
    room_manager._rooms.clear()


def test_ws_rejects_bad_role_ticket(client, db):
    from app.core.live_ticket import create_live_ticket
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()
    room_manager._used_tickets.clear()

    student = _mk_user(db, UserRole.STUDENT)
    session = _mk_session(db, student.id)
    sid = str(session.id)
    bad = create_live_ticket(user_id=str(student.id), session_id=sid, role="admin")

    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={bad}"):
            pass
    assert room_manager.room_exists(sid) is False
    room_manager._rooms.clear()


def test_tutor_question_detail_returns_answer_and_explanation(client, db):
    from app.models.question import Question
    from app.models.enums import AnswerType, SubjectArea

    tutor = _mk_user(db, UserRole.TUTOR)
    q = Question(
        id=uuid4(),
        external_id="q-live-1",
        subject_area=SubjectArea.MATH,
        prompt_html="<p>Solve 3(x-2)=2x+4</p>",
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
    assert body["answer_type"] == "MCQ"


def test_tutor_question_detail_explanation_falls_back_to_raw_import(client, db):
    from app.models.question import Question
    from app.models.enums import AnswerType, SubjectArea

    tutor = _mk_user(db, UserRole.TUTOR)
    q = Question(
        id=uuid4(),
        external_id="q-live-2",
        subject_area=SubjectArea.MATH,
        prompt_html="<p>What is 2+2?</p>",
        choices_json=["3", "4", "5", "6"],
        answer_type=AnswerType.MCQ,
        correct_answer_json={"index": 1},
        explanation_html=None,
        raw_import_json={"rationale_html": "<p>Add them up.</p>"},
        is_active=True,
    )
    db.add(q)
    db.commit()

    r = client.get(f"/api/v1/live/question/{q.id}", headers=_auth(tutor))
    assert r.status_code == 200
    assert "Add them up" in r.json()["explanation_html"]


def test_tutor_question_detail_404_for_unknown_question(client, db):
    tutor = _mk_user(db, UserRole.TUTOR)
    r = client.get(f"/api/v1/live/question/{uuid4()}", headers=_auth(tutor))
    assert r.status_code == 404


def test_tutor_question_detail_requires_tutor(client, db):
    student = _mk_user(db, UserRole.STUDENT)
    r = client.get(f"/api/v1/live/question/{uuid4()}", headers=_auth(student))
    assert r.status_code == 403


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


def test_ws_tutor_message_relays_to_student(client, db):
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
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            assert s_ws.receive_json()["type"] == "tutor_joined"
            assert t_ws.receive_json()["type"] == "snapshot"
            t_ws.send_json({"type": "stroke_start", "session_id": sid, "sender_role": "tutor",
                            "seq": 0, "payload": {"stroke_id": "t-1", "author": "tutor",
                                                  "color": "#b45309", "size": 3, "eraser": False,
                                                  "point": {"nx": 0.1, "ny": 0.2}}})
            got = s_ws.receive_json()
            assert got["type"] == "stroke_start"
            assert got["payload"]["stroke_id"] == "t-1"
    room_manager._rooms.clear()


def test_ws_idle_timeout_tears_down_room(client, db, monkeypatch):
    """A student that goes silent (no message/heartbeat) past the idle timeout is
    dropped, so the room clears and no phantom 'active session' lingers."""
    import app.api.v1.live as live_mod
    from app.core.live_ticket import create_live_ticket
    from app.api.v1.live import room_manager
    room_manager._rooms.clear()
    room_manager._used_tickets.clear()
    # Shrink the idle timeout so the test is fast.
    monkeypatch.setattr(live_mod, "LIVE_IDLE_TIMEOUT", 0.3)

    student = _mk_user(db, UserRole.STUDENT)
    session = _mk_session(db, student.id)
    sid = str(session.id)
    s_ticket = create_live_ticket(user_id=str(student.id), session_id=sid, role="student")

    with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={s_ticket}"):
        assert room_manager.student_present(sid) is True
        # Send nothing; wait past the shrunk idle timeout. The server should
        # break its receive loop and leave() the room.
        time.sleep(0.8)
        assert room_manager.room_exists(sid) is False
    room_manager._rooms.clear()


def test_ws_tutor_join_replays_cached_question(client, db):
    """A tutor joining AFTER the student navigated gets the current question
    from the server-side cache (no dependency on the student re-emitting)."""
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
        # Student announces its current question BEFORE any tutor is present.
        s_ws.send_json({"type": "question_changed", "session_id": sid, "sender_role": "student",
                        "seq": 0, "payload": {"question_index": 2, "question_id": "q-current"}})
        # Now a tutor joins — should receive snapshot, then the cached question_changed.
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            first = t_ws.receive_json()
            assert first["type"] == "snapshot"
            replayed = t_ws.receive_json()
            assert replayed["type"] == "question_changed"
            assert replayed["payload"]["question_id"] == "q-current"
    room_manager._rooms.clear()


@pytest.mark.asyncio
async def test_new_question_invalidates_cached_answer():
    """cache_student_message drops a cached answer when a new question arrives,
    so a joining tutor never gets a stale answer for the wrong question."""
    from app.services.live_room_manager import LiveRoomManager

    class _Fake:
        def __init__(self):
            self.sent = []

        async def send_json(self, d):
            self.sent.append(d)

    mgr = LiveRoomManager()
    await mgr.join("s-x", role="student", conn=_Fake())
    mgr.cache_student_message("s-x", {"type": "question_changed", "payload": {"question_id": "q1"}})
    mgr.cache_student_message("s-x", {"type": "answer_selected", "payload": {"question_id": "q1", "selected_answer": 1}})
    # Student moves to q2 -> the q1 answer must be evicted from the cache.
    mgr.cache_student_message("s-x", {"type": "question_changed", "payload": {"question_id": "q2"}})

    joiner = _Fake()
    await mgr.replay_cache_to("s-x", joiner)
    types = [m["type"] for m in joiner.sent]
    assert "question_changed" in types
    assert "answer_selected" not in types  # stale answer not replayed
    assert joiner.sent[0]["payload"]["question_id"] == "q2"


def test_ws_stroke_message_preserves_question_id(client, db):
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
        with client.websocket_connect(f"/api/v1/live/ws/{sid}?ticket={t_ticket}") as t_ws:
            assert s_ws.receive_json()["type"] == "tutor_joined"
            assert t_ws.receive_json()["type"] == "snapshot"
            s_ws.send_json({"type": "stroke_start", "session_id": sid, "sender_role": "student",
                            "seq": 0, "payload": {"stroke_id": "x1", "author": "student",
                                                  "color": "#111827", "size": 3, "eraser": False,
                                                  "point": {"x": 10, "y": 20}, "question_id": "q-99"}})
            got = t_ws.receive_json()
            assert got["type"] == "stroke_start"
            assert got["payload"]["question_id"] == "q-99"
            assert got["payload"]["point"] == {"x": 10, "y": 20}
    room_manager._rooms.clear()
