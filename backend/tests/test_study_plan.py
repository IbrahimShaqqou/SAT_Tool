"""Tests for import-driven study plan generation + the plan endpoint."""

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import MagicMock

from app.models.study_plan import StudyPlan
from app.models.test import TestSession
from app.services.mypractice_import import import_bundle
from app.services import study_plan_service as sp

CAP = Path(__file__).parent.parent.parent / "data" / "bluebook_captures"


def _attempt(qfile, roster, title="SAT Practice 7", score=1050):
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


# --------------------------------------------------------------------------- #
# Next-test recommendation (pure logic, stubbed inputs)
# --------------------------------------------------------------------------- #
def _reco(monkeypatch, taken, days):
    monkeypatch.setattr(sp, "_imported_test_numbers", lambda db, sid: set(taken))
    user = MagicMock()
    user.test_date = (datetime.now(timezone.utc) + timedelta(days=days)) if days is not None else None
    return sp.recommend_next_test(None, "sid", user)


def test_ladder_progression(monkeypatch):
    assert _reco(monkeypatch, [], None)[0] == 4
    assert _reco(monkeypatch, [4], None)[0] == 6
    assert _reco(monkeypatch, [4, 6], None)[0] == 5
    assert _reco(monkeypatch, [4, 6, 5], None)[0] == 7
    assert _reco(monkeypatch, [4, 6, 5, 7], None)[0] is None


def test_urgency_recommends_hard_tests_first(monkeypatch):
    assert _reco(monkeypatch, [4], 10)[0] == 6
    assert _reco(monkeypatch, [4, 6], 5)[0] == 7
    assert _reco(monkeypatch, [4, 6, 7], 5)[0] is None


def test_far_out_date_uses_ladder(monkeypatch):
    # Date set but beyond the urgency window -> behaves like no urgency.
    assert _reco(monkeypatch, [4], 60)[0] == 6


def test_no_date_uses_ladder(monkeypatch):
    assert _reco(monkeypatch, [4, 6], None)[0] == 5


# --------------------------------------------------------------------------- #
# Generation + integration
# --------------------------------------------------------------------------- #
def test_import_creates_plan_with_focus_cap(db, test_user):
    bundle = {"schemaVersion": 1, "attempts": [
        _attempt("pt7_harder_questions.json", "fp_plan_h", score=1050)]}
    import_bundle(db, bundle, student_id=test_user.id)
    db.commit()

    plans = db.query(StudyPlan).filter(StudyPlan.student_id == test_user.id).all()
    assert len(plans) == 1
    plan = plans[0]
    assert len(plan.focus_skills) <= sp.FOCUS_CAP
    # Focus skills are weakest-first and all below threshold.
    accs = [s["accuracy"] for s in plan.focus_skills]
    assert accs == sorted(accs)
    assert all(a < sp.WEAK_THRESHOLD for a in accs)  # all weak
    assert plan.recommended_next_test is not None  # only took one of the ladder


def test_first_import_has_no_deltas(db, test_user):
    bundle = {"schemaVersion": 1, "attempts": [
        _attempt("pt7_harder_questions.json", "fp_nodelta", score=1050)]}
    import_bundle(db, bundle, student_id=test_user.id)
    db.commit()
    plan = db.query(StudyPlan).filter(StudyPlan.student_id == test_user.id).first()
    assert plan.deltas is None


def test_second_import_populates_deltas(db, test_user):
    # First test (PT4), then a second (PT7) -> the PT7 plan compares to PT4.
    import_bundle(db, {"schemaVersion": 1, "attempts": [
        _attempt("pt4_harder_questions.json", "fp_d_pt4", title="SAT Practice 4", score=900)]},
        student_id=test_user.id)
    db.commit()
    import_bundle(db, {"schemaVersion": 1, "attempts": [
        _attempt("pt7_harder_questions.json", "fp_d_pt7", title="SAT Practice 7", score=1050)]},
        student_id=test_user.id)
    db.commit()

    pt7 = (db.query(StudyPlan)
           .filter(StudyPlan.student_id == test_user.id, StudyPlan.test_number == 7)
           .first())
    assert pt7.deltas is not None
    assert pt7.deltas["prev_test_number"] == 4
    assert pt7.deltas["score_change"] == 150  # 1050 - 900
    assert "skills" in pt7.deltas


def test_plan_endpoint_owner_and_tutor(client, db, test_user, test_tutor):
    from app.core.security import create_access_token
    # import for the student
    import_bundle(db, {"schemaVersion": 1, "attempts": [
        _attempt("pt7_harder_questions.json", "fp_ep", score=1050)]},
        student_id=test_user.id)
    db.commit()
    session = (db.query(TestSession)
               .filter(TestSession.student_id == test_user.id).first())

    # owner can read
    tok = create_access_token(subject=str(test_user.id))
    r = client.get(f"/api/v1/practice-tests/sessions/{session.id}/plan",
                   headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert "focus_skills" in r.json()

    # their tutor can read
    test_user.tutor_id = test_tutor.id
    db.commit()
    ttok = create_access_token(subject=str(test_tutor.id))
    r2 = client.get(f"/api/v1/practice-tests/sessions/{session.id}/plan",
                    headers={"Authorization": f"Bearer {ttok}"})
    assert r2.status_code == 200

    # unrelated tutor denied
    test_user.tutor_id = None
    db.commit()
    r3 = client.get(f"/api/v1/practice-tests/sessions/{session.id}/plan",
                    headers={"Authorization": f"Bearer {ttok}"})
    assert r3.status_code == 403
