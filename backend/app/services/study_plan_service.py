"""
Study plan generation — the import-driven coaching plan.

Given an imported practice-test attempt (a completed OFFICIAL_PRACTICE
TestSession with per-question StudentResponse rows), build the plan:
  - per-skill accuracy rollup from this attempt
  - the ~6 weakest skills as focus areas (rest -> also_review), each with its lesson
  - the recommended next test (difficulty ladder, or hardest-first when the real
    SAT is close)
  - deltas vs. the student's previous import

Generation is best-effort: callers wrap it so a failure never breaks the import.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.enums import TestStatus, TestType
from app.models.lesson import Lesson
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.study_plan import StudyPlan
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession
from app.models.user import User

# Tunable knobs (see design doc §3).
WEAK_THRESHOLD = 70.0          # accuracy % below which a skill is "weak"
FOCUS_CAP = 6                  # max skills in the active plan
FLAT_BAND = 1.0               # ± accuracy points treated as "flat" in deltas
URGENCY_DAYS = 21             # within this many days of test_date -> truest read first
SPACED_DAYS = 60              # at/beyond this many days (or no date) -> use the longer ladder

# Recommended progression. Ordered so the score tends to RISE test-to-test —
# each step is easier than the last, building confidence — until the finale.
# Difficulty of the official Bluebook tests, hardest->easiest, is roughly
# 11, 6, 5, 7, 10, 8, 9, 4 (community/prep-company consensus; CB publishes none).
#   - PT6 is hard and tends to read a little LOW (good honest baseline).
#   - PT7 is easier and one of the most accurate -> a natural score bump after 6.
#   - PT5 sits between 6 and 7, so it slots in as an extra rung when time allows.
#   - PT11 is the single most representative of today's real SAT, so it's saved
#     for LAST as a dress rehearsal (even though it's also the hardest test).
LADDER_CORE = [6, 7, 11]      # normal timeframe
LADDER_LONG = [6, 5, 7, 11]   # plenty of time -> extra mid step between 6 and 7
MOST_REPRESENTATIVE = [11, 7]  # truest predictors; recommend first when test is close

# Per-test encouragement, framed around the rising-score narrative.
_TEST_REASON = {
    6: ("Practice Test 6 runs on the harder side and tends to read a little low — "
        "treat it as our honest baseline. We climb from here."),
    5: ("A small step down in difficulty from Test 6 — a good place to see your "
        "work start paying off."),
    7: ("Test 7 is one of the most accurate practice tests and a bit easier than 6, "
        "so this is where you should see your score climbing."),
    11: ("Test 11 is the closest match to today's real SAT — we've saved it as your "
         "final dress rehearsal. Don't chase the number; it's the truest read you'll get."),
}


# --------------------------------------------------------------------------- #
# Per-skill rollup
# --------------------------------------------------------------------------- #
def _skill_rollup(db: Session, session_id) -> list[dict]:
    """
    Per-skill accuracy for one attempt's responses, weakest-first.
    Returns [{skill_id, name, domain, subject_area, correct, total, accuracy,
              lesson_id}].
    """
    responses = (
        db.query(StudentResponse)
        .filter(StudentResponse.test_session_id == session_id)
        .all()
    )
    if not responses:
        return []

    q_ids = [r.question_id for r in responses]
    questions = {
        q.id: q for q in db.query(Question).filter(Question.id.in_(q_ids)).all()
    }
    domains = {d.id: d for d in db.query(Domain).all()}
    skills = {s.id: s for s in db.query(Skill).all()}
    lesson_by_skill = {
        l.skill_id: str(l.id)
        for l in db.query(Lesson).filter(Lesson.skill_id.isnot(None)).all()
    }

    roll: dict = {}
    for r in responses:
        q = questions.get(r.question_id)
        if q is None:
            continue
        sk = skills.get(q.skill_id)
        dom = domains.get(q.domain_id)
        key = q.skill_id or f"_d{q.domain_id}"
        if key not in roll:
            roll[key] = {
                "skill_id": q.skill_id,
                "name": sk.name if sk else (dom.name if dom else "Uncategorized"),
                "domain": dom.name if dom else None,
                "subject_area": q.subject_area.value,
                "correct": 0,
                "total": 0,
                "lesson_id": lesson_by_skill.get(q.skill_id),
            }
        roll[key]["correct"] += 1 if r.is_correct else 0
        roll[key]["total"] += 1

    items = []
    for v in roll.values():
        v["accuracy"] = round(100 * v["correct"] / v["total"], 1) if v["total"] else 0.0
        items.append(v)
    items.sort(key=lambda s: (s["accuracy"], -s["total"]))
    return items


# --------------------------------------------------------------------------- #
# Next-test recommendation
# --------------------------------------------------------------------------- #
def _imported_test_numbers(db: Session, student_id) -> set:
    rows = (
        db.query(TestSession.session_state)
        .filter(
            TestSession.student_id == student_id,
            TestSession.test_type == TestType.OFFICIAL_PRACTICE,
            TestSession.status == TestStatus.COMPLETED,
        )
        .all()
    )
    nums = set()
    for (state,) in rows:
        n = (state or {}).get("test_number")
        if n is not None:
            nums.add(int(n))
    return nums


def _days_until_test(user: Optional[User]) -> Optional[int]:
    if not user or not getattr(user, "test_date", None):
        return None
    td = user.test_date
    today = datetime.now(timezone.utc).date()
    test_day = td.date() if hasattr(td, "date") else td
    return (test_day - today).days


def recommend_next_test(db: Session, student_id, user: Optional[User]) -> tuple[Optional[int], str]:
    """
    Return (next_test_number, reason).

    The sequence is built so the predicted score tends to rise test-to-test
    (each step a little easier than the last), ending on PT11 as the most
    representative dress rehearsal. Three time bands:
      - Urgent (<= URGENCY_DAYS): jump to the truest predictors (11, then 7).
      - Plenty of time (>= SPACED_DAYS or no date): the longer ladder w/ PT5.
      - In between: the core 6 -> 7 -> 11 progression.
    """
    taken = _imported_test_numbers(db, student_id)
    days = _days_until_test(user)

    # Urgency: real test is close -> go straight to the most representative tests.
    if days is not None and days <= URGENCY_DAYS:
        for n in MOST_REPRESENTATIVE:
            if n not in taken:
                return n, (
                    f"Your SAT is {days} day{'s' if days != 1 else ''} away, so we're going "
                    f"straight to Practice Test {n} — it's the closest match to the real "
                    f"test and the truest read of where you stand."
                )
        return None, (
            "Your test is close and you've taken the most representative practice tests. "
            "Retake your weakest one for a final read."
        )

    # Otherwise walk the confidence-building ladder. Use the longer one (with the
    # extra PT5 rung) only when there's clearly time for it.
    ladder = LADDER_LONG if (days is None or days >= SPACED_DAYS) else LADDER_CORE
    for n in ladder:
        if n not in taken:
            return n, _TEST_REASON.get(n, "A balanced next step on your way up.")

    return None, (
        "You've taken the core set of practice tests. Retake your weakest one for a fresh read."
    )


# --------------------------------------------------------------------------- #
# Deltas vs. previous import
# --------------------------------------------------------------------------- #
def compute_deltas(db: Session, student_id, current_session: TestSession,
                   current_rollup: list[dict]) -> Optional[dict]:
    """
    Compare this attempt to the student's most recent PRIOR import.
    Returns None if there's no prior attempt.
    """
    prior = (
        db.query(TestSession)
        .filter(
            TestSession.student_id == student_id,
            TestSession.test_type == TestType.OFFICIAL_PRACTICE,
            TestSession.status == TestStatus.COMPLETED,
            TestSession.id != current_session.id,
            TestSession.completed_at.isnot(None),
        )
        .order_by(TestSession.completed_at.desc())
        .first()
    )
    if prior is None:
        return None

    prior_rollup = {s["skill_id"]: s for s in _skill_rollup(db, prior.id) if s["skill_id"]}
    skills = []
    for s in current_rollup:
        sid = s["skill_id"]
        if sid is None or sid not in prior_rollup:
            continue
        prev = prior_rollup[sid]["accuracy"]
        cur = s["accuracy"]
        if cur - prev > FLAT_BAND:
            direction = "up"
        elif prev - cur > FLAT_BAND:
            direction = "down"
        else:
            direction = "flat"
        skills.append({
            "skill_id": sid,
            "name": s["name"],
            "prev_accuracy": prev,
            "accuracy": cur,
            "direction": direction,
        })

    cur_total = current_session.scaled_score
    prior_total = prior.scaled_score
    score_change = (
        cur_total - prior_total
        if (cur_total is not None and prior_total is not None) else None
    )

    return {
        "prev_test_number": (prior.session_state or {}).get("test_number"),
        "prev_total": prior_total,
        "score_change": score_change,
        "skills": skills,
    }


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #
def generate_plan_for_session(db: Session, session: TestSession) -> Optional[StudyPlan]:
    """
    Build (or replace) the study plan for one imported attempt. Returns the
    StudyPlan, or None if there's nothing to plan (no per-question data).
    Idempotent per test_session_id.
    """
    rollup = _skill_rollup(db, session.id)
    if not rollup:
        return None

    weak = [s for s in rollup if s["accuracy"] < WEAK_THRESHOLD]
    focus = weak[:FOCUS_CAP]
    also = weak[FOCUS_CAP:]

    student = db.query(User).filter(User.id == session.student_id).first()
    next_test, reason = recommend_next_test(db, session.student_id, student)
    deltas = compute_deltas(db, session.student_id, session, rollup)

    test_number = (session.session_state or {}).get("test_number")

    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.test_session_id == session.id)
        .first()
    )
    if plan is None:
        plan = StudyPlan(student_id=session.student_id, test_session_id=session.id)
        db.add(plan)

    plan.test_number = test_number
    plan.focus_skills = focus
    plan.also_review = also
    plan.recommended_next_test = next_test
    plan.next_test_reason = reason
    plan.deltas = deltas
    return plan
