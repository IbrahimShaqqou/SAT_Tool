"""Tests for the roster join-link flow (intake-free tutor attach)."""

import pytest
from fastapi import HTTPException

from app.api.v1.join import (
    get_join_link, get_join_info, join_tutor, JOIN_CODE_KEY,
)


def test_join_link_created_and_stable(db, test_tutor):
    r1 = get_join_link(db=db, current_user=test_tutor)
    assert r1.code
    assert r1.path == f"/join/{r1.code}"
    assert r1.link.endswith(f"/join/{r1.code}")
    # stored in profile_data
    assert (test_tutor.profile_data or {}).get(JOIN_CODE_KEY) == r1.code
    # idempotent: second call returns the same code
    r2 = get_join_link(db=db, current_user=test_tutor)
    assert r2.code == r1.code


def test_public_info_resolves_tutor_name(db, test_tutor):
    code = get_join_link(db=db, current_user=test_tutor).code
    info = get_join_info(code, db=db)
    assert info.code == code
    assert info.tutor_name == "Test Tutor"


def test_invalid_code_404(db):
    with pytest.raises(HTTPException) as ei:
        get_join_info("nope-not-real", db=db)
    assert ei.value.status_code == 404


def test_student_attaches_to_tutor(db, test_user, test_tutor):
    code = get_join_link(db=db, current_user=test_tutor).code
    assert test_user.tutor_id is None

    res = join_tutor(code, db=db, current_user=test_user)
    assert res.attached is True
    assert res.tutor_id == str(test_tutor.id)
    assert res.already_member is False
    assert test_user.tutor_id == test_tutor.id

    # idempotent re-join reports already_member
    res2 = join_tutor(code, db=db, current_user=test_user)
    assert res2.already_member is True
    assert test_user.tutor_id == test_tutor.id


def test_tutor_cannot_join_own_link(db, test_tutor):
    code = get_join_link(db=db, current_user=test_tutor).code
    with pytest.raises(HTTPException) as ei:
        join_tutor(code, db=db, current_user=test_tutor)
    assert ei.value.status_code in (400, 403)  # 403 (not a student) takes precedence


def test_non_student_rejected(db, test_tutor):
    # a second tutor tries to join the first tutor's link
    from uuid import uuid4
    from app.models.user import User
    from app.models.enums import UserRole
    from app.core.security import get_password_hash

    other = User(
        id=uuid4(), email="tutor2@test.com",
        password_hash=get_password_hash("TestPass123"),
        first_name="Other", last_name="Tutor",
        role=UserRole.TUTOR, is_active=True, is_verified=True, profile_data={},
    )
    db.add(other); db.commit(); db.refresh(other)

    code = get_join_link(db=db, current_user=test_tutor).code
    with pytest.raises(HTTPException) as ei:
        join_tutor(code, db=db, current_user=other)
    assert ei.value.status_code == 403
