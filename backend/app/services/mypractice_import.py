"""
MyPractice import service.

Ingests captured College Board MyPractice API data (the extension bundle, or
the per-attempt /questions captures used by the CLI) and:

  1. Upserts every question into the bank by external_id (content, choices,
     correct answer, official rationale, domain/skill from metadata).
  2. Reconstructs each practice test's three module variants
     (module_1_standard, module_2_easier, module_2_harder) from the attempts,
     classifying each attempt's Module 2 path per-section via real Module-1
     correctness (the same rule College Board used to route).
  3. Records each attempt's official scaled scores + per-domain theta on the
     PracticeTest metadata, to serve as ground-truth scoring anchors.

Both `import_bundle` (extension JSON) and the CLI script call into the same
core so behavior is identical.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.enums import AnswerType, SubjectArea, TestType, TestStatus
from app.models.practice_test import PracticeTest, PracticeTestModule
from app.models.question import Question
from app.models.response import StudentResponse
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession
from app.services.sat_scoring import should_get_harder_module_2

SECTION_SIZE = {"reading": 27, "math": 22}
SECTION_SUBJECT = {"reading": "reading_writing", "math": "math"}
SECTION_TIME = {"reading": 32, "math": 35}
CHOICE_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"]


# --------------------------------------------------------------------------- #
# Content mapping
# --------------------------------------------------------------------------- #
def _build_choices(answer: dict):
    """Return (choices_json, correct_answer_json) in bank format."""
    choices = answer.get("choices") or {}
    if choices:  # MCQ
        keys = [k for k in CHOICE_ORDER if k in choices]
        choices_json = [choices[k].get("body", "") for k in keys]
        correct = answer.get("correctChoice")
        idx = keys.index(correct) if correct in keys else 0
        return choices_json, {"index": idx}
    # SPR
    correct = answer.get("correctChoice")
    return None, {"answers": [correct] if correct is not None else []}


def _build_prompt_html(item: dict) -> str:
    parts = []
    passage = item.get("passage")
    if isinstance(passage, dict) and passage.get("body"):
        parts.append(passage["body"])
    if item.get("prompt"):
        parts.append(item["prompt"])
    return "\n".join(parts)


def _resolve_skill_id(metadata: dict, skill_by_code: dict) -> Optional[int]:
    sec = metadata.get("SECONDARY_CLASS_CD")
    if sec and sec in skill_by_code:
        return skill_by_code[sec]
    tert = metadata.get("TERTIARY_CLASS_CD") or ""
    bits = tert.split(".")
    if len(bits) >= 2:
        prefix = f"{bits[0]}.{bits[1]}."
        if prefix in skill_by_code:
            return skill_by_code[prefix]
    return None


def _upsert_question(db, item, section, domain_by_code, skill_by_code, stats, cache) -> Optional[str]:
    """
    Upsert a question from an API item. Returns external_id, or None if unusable.

    `cache` maps external_id -> Question for rows already seen this run (whether
    fetched from the DB or just-added). This is essential: Module 1 is identical
    across the easier/harder attempts, so the same external_id arrives twice in
    one transaction. Without the cache the second occurrence would queue a second
    INSERT of the same key and trip the unique constraint on flush.
    """
    ext = item.get("externalId")
    if not ext:
        # Old-format capture (questionId only) — can't join to the bank reliably.
        stats["skipped_no_extid"] += 1
        return None

    answer = item.get("answer") or {}
    answer_type = AnswerType.MCQ if answer.get("choices") else AnswerType.SPR
    choices_json, correct_json = _build_choices(answer)
    meta = item.get("metadata") or {}
    subject = SubjectArea.MATH if section == "math" else SubjectArea.READING_WRITING

    q = cache.get(ext)
    if q is None:
        q = db.query(Question).filter(Question.external_id == ext).first()
    if q is None:
        q = Question(external_id=ext)
        db.add(q)
        stats["inserted"] += 1
    else:
        stats["updated"] += 1
    cache[ext] = q

    q.subject_area = subject
    q.answer_type = answer_type
    q.domain_id = domain_by_code.get(meta.get("PRIMARY_CLASS_CD"))
    q.skill_id = _resolve_skill_id(meta, skill_by_code)
    q.prompt_html = _build_prompt_html(item)
    q.choices_json = choices_json
    q.correct_answer_json = correct_json
    q.explanation_html = answer.get("rationale")
    q.is_active = True
    q.is_verified = True
    q.raw_import_json = {
        "source": "mypractice_api",
        "questionId": item.get("questionId"),
        "vaultId": item.get("vaultId"),
        "metadata": meta,
        "section": section,
        "displayNumber": item.get("displayNumber"),
    }
    q.imported_at = datetime.now(timezone.utc)
    if q.domain_id is None:
        stats["no_domain"] += 1
    if q.skill_id is None:
        stats["no_skill"] += 1
    return ext


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _questions_to_sections(questions_payload) -> dict:
    """
    Normalize a /questions payload into {section_id: [items sorted by sequence]}.
    Accepts the list-of-groups shape [{id, items}, ...].
    """
    out = {}
    if not isinstance(questions_payload, list):
        return out
    for group in questions_payload:
        if isinstance(group, dict) and "items" in group:
            out[group.get("id")] = sorted(
                group["items"], key=lambda x: x.get("sequence", 0)
            )
    return out


def _test_number_from_title(title: str) -> Optional[int]:
    if not title:
        return None
    m = re.search(r"Practice\s+(\d+)", title)
    return int(m.group(1)) if m else None


def _classify_attempt(sections: dict):
    """
    For one attempt's sections, return per-section:
      {section: {"m1": [ext...], "m2": [ext...], "path": "harder"|"easier",
                 "m1_correct": int}}
    Path is decided from real Module-1 correctness (CB's routing rule).
    """
    result = {}
    for section, size in SECTION_SIZE.items():
        items = sections.get(section, [])
        if not items:
            continue
        m1_items = items[:size]
        m2_items = items[size:]
        m1_correct = sum(
            1 for it in m1_items if (it.get("answer") or {}).get("correct")
        )
        path = "harder" if should_get_harder_module_2(m1_correct, len(m1_items)) else "easier"
        result[section] = {
            "m1": [it.get("externalId") for it in m1_items],
            "m2": [it.get("externalId") for it in m2_items],
            "path": path,
            "m1_correct": m1_correct,
        }
    return result


def _extract_official_scores(score_object: dict) -> dict:
    """Pull the official scaled scores + per-domain theta into a compact anchor."""
    out = {
        "total": (score_object.get("totalScore") or {}).get("score"),
        "submittedAt": score_object.get("asmtSubmissionStartTime"),
        "rosterEntryId": score_object.get("rosterEntryId"),
        "sections": {},
        "domain_theta": {},
    }
    for sec in score_object.get("sectionScores", []) or []:
        name = "reading_writing" if sec.get("tierName", "").startswith("Reading") else "math"
        out["sections"][name] = {
            "score": sec.get("score"),
            "correct": sec.get("correctAnswers"),
            "total": sec.get("totalQuestions"),
        }
    qbd = score_object.get("questionBankData") or {}
    for ds in qbd.get("domainScores", []) or []:
        for band in ds.get("scoreBands", []) or []:
            out["domain_theta"][band.get("primaryClassCd")] = {
                "theta": band.get("theta"),
                "band": band.get("scoreBandCd"),
            }
    return out


# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #
def import_attempts(
    db: Session,
    attempts: list,
    *,
    dry_run: bool = False,
    student_id=None,
) -> dict:
    """
    Import a list of attempts. Each attempt is a dict with at least:
      - displayTitle (or scoreObject.displayTitle)
      - questions: /questions payload (list of {id, items})
      - scoreObject: /scores object (optional but recommended)

    When `student_id` is provided, each attempt also becomes a completed
    OFFICIAL_PRACTICE TestSession (with per-question StudentResponse rows and the
    official scaled scores + per-domain theta) owned by that student, so it shows
    up in their history, the results page, and the tutor dashboard. Attempts are
    de-duplicated by rosterEntryId so re-imports don't create duplicates.

    Returns a summary dict.
    """
    domain_by_code = {d.code: d.id for d in db.query(Domain).all()}
    skill_by_code = {s.code: s.id for s in db.query(Skill).all()}

    stats = {"inserted": 0, "updated": 0, "no_domain": 0, "no_skill": 0,
             "skipped_no_extid": 0}

    # Prefetch every external_id referenced across the bundle in one query, so we
    # never N+1 (the per-row lookup was timing out large imports) and never queue
    # a duplicate INSERT for an id repeated across attempts (Module 1 overlap).
    all_ext = {
        it.get("externalId")
        for att in attempts
        for grp in (att.get("questions") or [])
        if isinstance(grp, dict)
        for it in grp.get("items", [])
        if it.get("externalId")
    }
    q_cache = {}
    if all_ext:
        for q in db.query(Question).filter(Question.external_id.in_(list(all_ext))).all():
            q_cache[q.external_id] = q

    # Group attempts by test number.
    by_test: dict[int, list] = {}
    for att in attempts:
        so = att.get("scoreObject") or {}
        title = att.get("displayTitle") or so.get("displayTitle")
        n = _test_number_from_title(title)
        if n is None:
            continue
        by_test.setdefault(n, []).append(att)

    tests_summary = []
    for test_number, atts in sorted(by_test.items()):
        # Accumulate module variants across this test's attempts.
        module_sets = {  # section -> variant -> [ext...]
            "reading": {"m1": None, "easier": None, "harder": None},
            "math": {"m1": None, "easier": None, "harder": None},
        }
        official = []

        for att in atts:
            sections = _questions_to_sections(att.get("questions"))
            # Upsert all questions first.
            for section, items in sections.items():
                for it in items:
                    _upsert_question(db, it, section, domain_by_code, skill_by_code, stats, q_cache)
            # Classify + record module sets.
            classed = _classify_attempt(sections)
            for section, info in classed.items():
                if module_sets[section]["m1"] is None and info["m1"]:
                    module_sets[section]["m1"] = info["m1"]
                variant = info["path"]  # "easier" | "harder"
                if module_sets[section][variant] is None and info["m2"]:
                    module_sets[section][variant] = info["m2"]
            # Official scores.
            so = att.get("scoreObject")
            if so:
                official.append(_extract_official_scores(so))

        # Build module configs from whatever variants we have.
        module_configs = []
        coverage = {}
        for section, size in SECTION_SIZE.items():
            subject = SECTION_SUBJECT[section]
            time_limit = SECTION_TIME[section]
            ms = module_sets[section]
            present = []
            if ms["m1"]:
                module_configs.append((subject, 1, "module_1_standard", time_limit, ms["m1"]))
                present.append("m1")
            if ms["easier"]:
                module_configs.append((subject, 2, "module_2_easier", time_limit, ms["easier"]))
                present.append("m2_easier")
            if ms["harder"]:
                module_configs.append((subject, 2, "module_2_harder", time_limit, ms["harder"]))
                present.append("m2_harder")
            coverage[subject] = present

        # Need at least Module 1 + one Module 2 variant per section to be useful.
        usable = all(
            "m1" in coverage.get(SECTION_SUBJECT[s], [])
            and any(v.startswith("m2") for v in coverage.get(SECTION_SUBJECT[s], []))
            for s in SECTION_SIZE
        )

        test_result = {
            "test_number": test_number,
            "attempts": len(atts),
            "coverage": coverage,
            "official_anchors": len(official),
            "usable": usable,
            "modules_seeded": 0,
        }

        if usable and not dry_run:
            existing = db.query(PracticeTest).filter(
                PracticeTest.test_number == test_number
            ).first()
            if existing:
                db.delete(existing)
                db.flush()
            pt = PracticeTest(
                test_number=test_number,
                test_name=f"SAT Practice Test {test_number}",
                description=(
                    f"Official College Board Practice Test {test_number}, imported "
                    f"from MyPractice API with adaptive Module 2 variants."
                ),
                is_active=True,
                date_extracted=datetime.now(timezone.utc),
                note="Imported via mypractice_import service.",
                test_metadata={
                    "source": "mypractice_api",
                    "official_scores": official,  # scoring anchors
                    "coverage": coverage,
                },
            )
            db.add(pt)
            db.flush()
            for subject, num, mtype, time_limit, uids in module_configs:
                db.add(PracticeTestModule(
                    practice_test_id=pt.id,
                    module_number=num,
                    module_type=mtype,
                    subject_area=subject,
                    time_limit_minutes=time_limit,
                    question_count=len(uids),
                    question_uids=uids,
                ))
            test_result["modules_seeded"] = len(module_configs)

        # Create per-student result records (sessions + responses) for each attempt,
        # then generate the import-driven study plan for each (best-effort).
        results_created = 0
        plans_created = 0
        if student_id is not None and not dry_run:
            new_sessions = []
            for att in atts:
                sess = _create_result_session(db, student_id, test_number, att)
                if sess is not None:
                    results_created += 1
                    new_sessions.append(sess)
            if new_sessions:
                db.flush()  # responses must be persisted before the plan reads them
                for sess in new_sessions:
                    try:
                        from app.services.study_plan_service import generate_plan_for_session
                        if generate_plan_for_session(db, sess) is not None:
                            plans_created += 1
                    except Exception as e:  # never fail the import on plan generation
                        print(f"[import] study plan generation failed for {sess.id}: {e}")
        test_result["results_created"] = results_created
        test_result["plans_created"] = plans_created

        tests_summary.append(test_result)

    return {
        "questions": stats,
        "tests": tests_summary,
        "dry_run": dry_run,
    }


# --------------------------------------------------------------------------- #
# Per-student result records
# --------------------------------------------------------------------------- #
def _create_result_session(db: Session, student_id, test_number: int, att: dict):
    """
    Turn one attempt into a completed OFFICIAL_PRACTICE TestSession + per-question
    StudentResponse rows, owned by `student_id`. Idempotent per (student, roster).
    Returns the created TestSession, or None if it already existed / was skipped.
    """
    so = att.get("scoreObject") or {}
    roster = att.get("rosterEntryId") or so.get("rosterEntryId")
    sections = _questions_to_sections(att.get("questions"))
    if not sections:
        return None

    # Dedup: same student + same Bluebook attempt id.
    if roster:
        existing = (
            db.query(TestSession)
            .filter(
                TestSession.student_id == student_id,
                TestSession.test_type == TestType.OFFICIAL_PRACTICE,
                TestSession.session_state["roster_entry_id"].astext == roster,
            )
            .first()
        )
        if existing:
            return None

    official = _extract_official_scores(so)
    total_score = official.get("total")

    # Build modules_completed exactly like the live submit-module flow, so the
    # /results endpoint scores it identically.
    modules_completed = []
    total_correct = 0
    total_answered = 0
    for section, size in SECTION_SIZE.items():
        items = sections.get(section, [])
        if not items:
            continue
        subject = SECTION_SUBJECT[section]
        m1 = items[:size]
        m2 = items[size:]
        for mod_num, chunk in ((1, m1), (2, m2)):
            correct = sum(1 for it in chunk if (it.get("answer") or {}).get("correct"))
            total_correct += correct
            total_answered += len(chunk)
            modules_completed.append({
                "module_number": (1 if section == "reading" else 3) + (mod_num - 1),
                "subject": subject,
                "module_num": mod_num,
                "correct": correct,
                "total": len(chunk),
                "time_spent_seconds": None,
            })

    completed_at = _parse_iso(so.get("asmtSubmissionStartTime"))
    session = TestSession(
        student_id=student_id,
        test_type=TestType.OFFICIAL_PRACTICE,
        subject_area=None,
        title=so.get("displayTitle") or f"SAT Practice Test {test_number}",
        status=TestStatus.COMPLETED,
        total_questions=total_answered,
        questions_answered=total_answered,
        questions_correct=total_correct,
        scaled_score=total_score,
        completed_at=completed_at,
        started_at=completed_at,
        session_state={
            "practice_test_id": None,  # set below if the test is seeded
            "test_number": test_number,
            "current_module": None,
            "modules_completed": modules_completed,
            "module_2_paths": {
                SECTION_SUBJECT[s]: _classify_attempt(sections).get(s, {}).get("path")
                for s in SECTION_SIZE if sections.get(s)
            },
            "roster_entry_id": roster,
            "source": "mypractice_import",
            "official_scores": official,
        },
    )
    # Link to the seeded practice test if present.
    pt = db.query(PracticeTest).filter(PracticeTest.test_number == test_number).first()
    if pt:
        st = dict(session.session_state)
        st["practice_test_id"] = str(pt.id)
        session.session_state = st
    db.add(session)
    db.flush()

    # Per-question responses (only those that resolve to a bank question).
    ext_ids = [it.get("externalId") for sec in sections.values() for it in sec if it.get("externalId")]
    qmap = {
        q.external_id: q
        for q in db.query(Question).filter(Question.external_id.in_(ext_ids)).all()
    } if ext_ids else {}

    for section, items in sections.items():
        for it in items:
            q = qmap.get(it.get("externalId"))
            if q is None:
                continue
            ans = it.get("answer") or {}
            db.add(StudentResponse(
                student_id=student_id,
                question_id=q.id,
                test_session_id=session.id,
                response_json={"raw": ans.get("response")},
                is_correct=bool(ans.get("correct")),
                submitted_at=completed_at or datetime.now(timezone.utc),
            ))
    return session


def _parse_iso(value):
    """
    Parse an ISO-8601 timestamp, tolerating College Board's variable fractional
    seconds (e.g. ".2525Z" — 4 digits, which datetime.fromisoformat rejects on
    Python < 3.11). Normalizes the fraction to 6 digits before parsing.
    """
    if not value or not isinstance(value, str):
        return None
    s = value.strip().replace("Z", "+00:00")
    m = re.match(r"^(.*\.)(\d+)(\+\d{2}:\d{2}|-\d{2}:\d{2})?$", s)
    if m:
        frac = (m.group(2) + "000000")[:6]
        s = f"{m.group(1)}{frac}{m.group(3) or ''}"
    try:
        return datetime.fromisoformat(s)
    except (ValueError, AttributeError):
        return None


def import_bundle(db: Session, bundle: dict, *, dry_run: bool = False, student_id=None) -> dict:
    """Entry point for the extension bundle (schemaVersion 1)."""
    attempts = bundle.get("attempts") or []
    return import_attempts(db, attempts, dry_run=dry_run, student_id=student_id)
