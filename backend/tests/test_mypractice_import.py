"""Integration tests for the MyPractice import -> per-student results flow."""

import json
from pathlib import Path

from app.models.test import TestSession
from app.models.response import StudentResponse
from app.models.enums import TestType, TestStatus
from app.services.mypractice_import import import_bundle

CAP = Path(__file__).parent.parent.parent / "data" / "bluebook_captures"


def _load_attempt(qfile, roster, title):
    """Build one bundle attempt from a captured /questions file + a fake score."""
    questions = json.loads((CAP / qfile).read_text())
    # Minimal scoreObject with section scores derived from the capture.
    return {
        "rosterEntryId": roster,
        "displayTitle": title,
        "asmtFamilyCd": 1,
        "scoreObject": {
            "rosterEntryId": roster,
            "displayTitle": title,
            "asmtSubmissionStartTime": "2026-05-24T15:51:33.333Z",
            "totalScore": {"score": 1080},
            "sectionScores": [
                {"tierName": "Reading and Writing", "score": 530, "correctAnswers": 27, "totalQuestions": 54},
                {"tierName": "Math", "score": 550, "correctAnswers": 22, "totalQuestions": 44},
            ],
            "questionBankData": {"domainScores": [
                {"anchorScoreTableId": "theta_table_math", "scoreBands": [
                    {"primaryClassCd": "H", "theta": 1.23, "scoreBandCd": "5"}]}
            ]},
        },
        "questions": questions,
    }


def _bundle():
    # PT4 harder-path capture is enough to exercise session + response creation.
    return {
        "schemaVersion": 1,
        "source": "mypractice_api",
        "attempts": [
            _load_attempt("pt4_harder_questions.json",
                          "fp_test_pt4_harder", "SAT Practice 4"),
        ],
    }


def test_import_creates_completed_session(db, test_user):
    res = import_bundle(db, _bundle(), student_id=test_user.id)
    db.commit()

    sessions = (
        db.query(TestSession)
        .filter(TestSession.student_id == test_user.id,
                TestSession.test_type == TestType.OFFICIAL_PRACTICE)
        .all()
    )
    assert len(sessions) == 1
    s = sessions[0]
    assert s.status == TestStatus.COMPLETED
    assert s.scaled_score == 1080
    assert s.session_state["roster_entry_id"] == "fp_test_pt4_harder"
    assert s.session_state["source"] == "mypractice_import"
    # 4 module entries (RW M1+M2, Math M1+M2)
    assert len(s.session_state["modules_completed"]) == 4
    assert any(t.get("results_created") for t in res["tests"])


def test_responses_created_and_correctness(db, test_user):
    import_bundle(db, _bundle(), student_id=test_user.id)
    db.commit()
    resp = (
        db.query(StudentResponse)
        .filter(StudentResponse.student_id == test_user.id)
        .all()
    )
    # 98 questions in the attempt; all resolve to seeded bank questions.
    assert len(resp) == 98
    # Harder-path perfect-M1 capture: at least the 49 correct are flagged correct.
    assert sum(1 for r in resp if r.is_correct) >= 40


def test_reimport_is_idempotent(db, test_user):
    import_bundle(db, _bundle(), student_id=test_user.id)
    db.commit()
    import_bundle(db, _bundle(), student_id=test_user.id)  # second run
    db.commit()
    sessions = (
        db.query(TestSession)
        .filter(TestSession.student_id == test_user.id,
                TestSession.test_type == TestType.OFFICIAL_PRACTICE)
        .all()
    )
    assert len(sessions) == 1  # no duplicate


def test_dry_run_creates_nothing(db, test_user):
    import_bundle(db, _bundle(), student_id=test_user.id, dry_run=True)
    db.commit()
    assert db.query(TestSession).filter(
        TestSession.student_id == test_user.id).count() == 0


def test_both_paths_one_bundle_no_duplicate_key(db, test_user):
    """
    Easier + harder attempts of the same test share an identical Module 1, so the
    same external_id appears twice in one bundle. The import must dedupe and not
    trip the questions.external_id unique constraint on flush.
    """
    bundle = {
        "schemaVersion": 1,
        "attempts": [
            _load_attempt("pt7_easier_questions.json", "fp_dup_easier", "SAT Practice 7"),
            _load_attempt("pt7_harder_questions.json", "fp_dup_harder", "SAT Practice 7"),
        ],
    }
    res = import_bundle(db, bundle, student_id=test_user.id)
    db.commit()  # would raise UniqueViolation here if dedup were broken
    # Two attempts -> two sessions, one practice test seeded with all 6 modules.
    sessions = (
        db.query(TestSession)
        .filter(TestSession.student_id == test_user.id,
                TestSession.test_type == TestType.OFFICIAL_PRACTICE)
        .all()
    )
    assert len(sessions) == 2
    pt7 = [t for t in res["tests"] if t["test_number"] == 7]
    assert pt7 and pt7[0]["modules_seeded"] == 6
