"""
Regression test for DELETE /practice-tests/sessions/{id}.

Builds the session the SAME way production does — via import_bundle from a real
Bluebook capture — then calls the endpoint function directly (the TestClient is
unusable under this repo's Starlette/httpx pin). Deleting must remove the
session and all its children without an IntegrityError (the 500 the user hit).
"""

import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.v1.practice_tests import delete_practice_test_session
from app.services.mypractice_import import import_bundle
from app.models.enums import TestType
from app.models.test import TestSession, TestQuestion
from app.models.response import StudentResponse
from app.models.study_plan import StudyPlan

CAP = Path(__file__).parent.parent.parent / "data" / "bluebook_captures"


def _attempt(qfile, roster, title="SAT Practice 6", score=1200):
    questions = json.loads((CAP / qfile).read_text())
    return {
        "rosterEntryId": roster,
        "displayTitle": title,
        "asmtFamilyCd": 1,
        "scoreObject": {
            "rosterEntryId": roster, "displayTitle": title,
            "asmtSubmissionStartTime": "2026-05-24T15:51:33.333Z",
            "totalScore": {"score": score},
            "sectionScores": [
                {"tierName": "Reading and Writing", "score": score // 2, "correctAnswers": 27, "totalQuestions": 54},
                {"tierName": "Math", "score": score // 2, "correctAnswers": 22, "totalQuestions": 44},
            ],
            "questionBankData": {"domainScores": []},
        },
        "questions": questions,
    }


def _import_one(db, student_id, roster="del_test"):
    bundle = {"schemaVersion": 1, "attempts": [
        _attempt("pt6_harder_questions.json", roster)]}
    import_bundle(db, bundle, student_id=student_id)
    db.commit()
    return (db.query(TestSession)
            .filter(TestSession.student_id == student_id,
                    TestSession.test_type == TestType.OFFICIAL_PRACTICE)
            .first())


def test_delete_removes_imported_session_and_children(db, test_user):
    s = _import_one(db, test_user.id)
    sid = s.id

    # Whatever children the real import created, capture their counts > 0 where
    # expected, then assert all are gone after delete.
    assert db.query(StudentResponse).filter(StudentResponse.test_session_id == sid).count() > 0
    assert db.query(StudyPlan).filter(StudyPlan.test_session_id == sid).count() == 1

    out = delete_practice_test_session(sid, db=db, current_user=test_user)
    assert out["deleted"] is True
    assert out["test_number"] == 6

    # Session and every child gone — no IntegrityError.
    assert db.query(TestSession).filter(TestSession.id == sid).count() == 0
    assert db.query(StudentResponse).filter(StudentResponse.test_session_id == sid).count() == 0
    assert db.query(TestQuestion).filter(TestQuestion.test_session_id == sid).count() == 0
    assert db.query(StudyPlan).filter(StudyPlan.test_session_id == sid).count() == 0


def test_delete_then_reimport_is_clean(db, test_user):
    """After deletion the same test can be re-imported with no leftover rows."""
    s = _import_one(db, test_user.id)
    sid = s.id
    delete_practice_test_session(sid, db=db, current_user=test_user)

    s2 = _import_one(db, test_user.id, roster="del_test_2")
    # Exactly one live session, and its responses aren't polluted by the old one.
    assert (db.query(TestSession)
            .filter(TestSession.student_id == test_user.id,
                    TestSession.test_type == TestType.OFFICIAL_PRACTICE)
            .count()) == 1
    assert db.query(StudentResponse).filter(StudentResponse.test_session_id == s2.id).count() > 0


def test_delete_forbidden_for_unrelated_user(db, test_user, test_tutor):
    s = _import_one(db, test_user.id)
    test_user.tutor_id = None
    db.commit()
    with pytest.raises(HTTPException) as ei:
        delete_practice_test_session(s.id, db=db, current_user=test_tutor)
    assert ei.value.status_code == 403
    assert db.query(TestSession).filter(TestSession.id == s.id).count() == 1
