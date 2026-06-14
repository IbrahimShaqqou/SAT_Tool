"""Tests for study-plan prioritization (frequency × learnability × weakness × proximity)."""

import uuid
from datetime import datetime, timezone, timedelta

from app.services import study_priority as sp
from app.models.user import User
from app.models.enums import (
    UserRole, SubjectArea, AnswerType, DifficultyLevel, WorklistStatus,
    TestType, TestStatus,
)
from app.models.taxonomy import Domain, Skill
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.test import TestSession
from app.core.security import get_password_hash
from app.services import worklist_service as wl


# --------------------------- pure scoring --------------------------- #
def test_grammar_outranks_reading_at_equal_weakness():
    # SEC (grammar, learnable) should beat CAS (reading comprehension, slow).
    assert sp.priority_score(40, 'SEC', 30) > sp.priority_score(40, 'CAS', 30)


def test_algebra_outranks_geometry():
    # H (Algebra, 35% + learnable) >> S (Geo/Trig, 15%).
    assert sp.priority_score(40, 'H', 30) > sp.priority_score(40, 'S', 30)


def test_weaker_skill_outranks_stronger_same_domain():
    assert sp.priority_score(30, 'H', 30) > sp.priority_score(60, 'H', 30)


def test_mastered_skill_scores_zero():
    assert sp.priority_score(70, 'H', 30) == 0.0
    assert sp.priority_score(85, 'H', 30) == 0.0


def test_proximity_sharpens_impact_dominance():
    # As the test nears, the high-impact skill should DOMINATE the low-impact one
    # more decisively. Impact factors are <1, so the right measure is the ratio
    # (relative dominance), which widens even as the absolute gap narrows.
    far = sp.priority_score(40, 'H', 90) / sp.priority_score(40, 'S', 90)
    near = sp.priority_score(40, 'H', 5) / sp.priority_score(40, 'S', 5)
    assert near > far


def test_hero_count_shrinks_as_test_nears():
    assert sp.how_many_hero_skills(5) < sp.how_many_hero_skills(20) <= sp.how_many_hero_skills(90)
    assert sp.how_many_hero_skills(5) >= 1  # never zero
    assert sp.how_many_hero_skills(None) == 3


# --------------------------- generation ordering --------------------------- #
def _domain(db, code, subj=SubjectArea.MATH):
    d = Domain(name=f"D-{code}", subject_area=subj, code=code)
    db.add(d); db.flush(); return d


def _skill(db, domain, name):
    s = Skill(name=name, domain_id=domain.id, code=f"SK{uuid.uuid4().hex[:4]}")
    db.add(s); db.flush(); return s


def _q(db, skill, domain):
    q = Question(external_id=f"ext-{uuid.uuid4().hex[:8]}", subject_area=SubjectArea.MATH,
                 domain_id=domain.id, skill_id=skill.id, answer_type=AnswerType.MCQ,
                 difficulty=DifficultyLevel.MEDIUM, prompt_html="x", choices_json=["A", "B"],
                 correct_answer_json={"index": 0}, is_active=True)
    db.add(q); db.flush(); return q


def _student(db):
    u = User(id=uuid.uuid4(), email=f"s-{uuid.uuid4().hex[:6]}@t.com",
             password_hash=get_password_hash("TestPass123"), first_name="S", last_name="T",
             role=UserRole.STUDENT, is_active=True, is_verified=True, profile_data={})
    db.add(u); db.flush(); return u


def test_generation_orders_by_priority_not_raw_accuracy(db):
    # Geo/Trig skill is WEAKER (0%) but low-impact; Algebra skill less weak (40%)
    # but high-impact. Priority should still rank Algebra at/above Geo here OR at
    # least not blindly put the weakest first — verify Algebra outranks by score.
    geo_dom = _domain(db, 'S'); alg_dom = _domain(db, 'H')
    geo_sk = _skill(db, geo_dom, "Geometry basics")
    alg_sk = _skill(db, alg_dom, "Linear equations")
    student = _student(db)
    session = TestSession(student_id=student.id, test_type=TestType.OFFICIAL_PRACTICE,
                          status=TestStatus.COMPLETED, questions_answered=4,
                          questions_correct=1, current_question_index=0,
                          session_state={"test_number": 6})
    db.add(session); db.flush()
    # geo: 0/2 (0%), algebra: 2/5 -> set up responses
    gq1, gq2 = _q(db, geo_sk, geo_dom), _q(db, geo_sk, geo_dom)
    for q in (gq1, gq2):
        db.add(StudentResponse(student_id=student.id, question_id=q.id, test_session_id=session.id,
                               is_correct=False, response_json={"index": 1},
                               submitted_at=datetime.now(timezone.utc)))
    aqs = [_q(db, alg_sk, alg_dom) for _ in range(5)]
    for i, q in enumerate(aqs):
        db.add(StudentResponse(student_id=student.id, question_id=q.id, test_session_id=session.id,
                               is_correct=(i < 2), response_json={"index": 0 if i < 2 else 1},
                               submitted_at=datetime.now(timezone.utc)))
    db.flush()

    created = wl.generate_from_session(db, session)
    by_skill = {c.skill_id: c for c in created}
    assert alg_sk.id in by_skill and geo_sk.id in by_skill
    # Algebra (high impact) should get the earlier (lower) position.
    assert by_skill[alg_sk.id].position < by_skill[geo_sk.id].position
