#!/usr/bin/env python3
"""
Import official College Board practice tests from captured MyPractice API responses.

This replaces the old scrape + fuzzy-match pipeline. The MyPractice `/questions`
endpoint returns, for one attempt, the 98 questions that attempt administered
(Module 1 + ONE Module 2 path) with full content, the correct answer, the
official rationale, and the stable `externalId` (== questions.external_id).

To reconstruct a full adaptive test we need two attempts per test:
  - an EASIER-path attempt (low score -> easier Module 2)
  - a HARDER-path attempt (high score -> harder Module 2)
Module 1 is identical across both; Module 2 differs. The union is the full form.

For each test this script:
  1. Upserts every question into the bank by external_id (content, choices,
     correct answer, rationale, domain/skill from metadata).
  2. Replaces the PracticeTest's modules with three module_type rows
     (module_1_standard, module_2_easier, module_2_harder), each carrying the
     ordered external_id list the College Board actually used.

Question content (prompt/passage/choices) is reconstructed to match the format
already used in the bank: prompt_html = passage body + prompt; choices_json =
list of HTML strings in A,B,C,D order; correct_answer_json = {"index": n} (MCQ)
or {"answers": [str]} (SPR).

Usage:
    python3 scripts/import_from_mypractice_api.py            # import PT4-7
    python3 scripts/import_from_mypractice_api.py --tests 4 5
    python3 scripts/import_from_mypractice_api.py --dry-run
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.enums import AnswerType, SubjectArea, DifficultyLevel
from app.models.practice_test import PracticeTest, PracticeTestModule
from app.models.question import Question
from app.models.taxonomy import Domain, Skill


# Captures live in the repo-root data dir (../../data from backend/scripts)
CAPTURES = Path(__file__).parent.parent.parent / "data" / "bluebook_captures"

# Module sizes per section (official digital SAT)
SECTION_SIZE = {"reading": 27, "math": 22}
SECTION_SUBJECT = {"reading": "reading_writing", "math": "math"}
SECTION_TIME = {"reading": 32, "math": 35}

# test_number -> (easier_file, harder_file, testId, display name)
TEST_FILES = {
    4: ("pt4_easier_questions.json", "pt4_harder_questions.json"),
    5: ("pt5_easier_questions.json", "pt5_harder_questions.json"),
    6: ("pt6_easier_questions.json", "pt6_harder_questions.json"),
    7: ("pt7_easier_questions.json", "pt7_harder_questions.json"),
}

CHOICE_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H"]


def load_capture(filename: str) -> dict:
    """Load a /questions capture, return {section_id: [items sorted by sequence]}."""
    path = CAPTURES / filename
    data = json.loads(path.read_text())
    out = {}
    for group in data:
        out[group["id"]] = sorted(group["items"], key=lambda x: x["sequence"])
    return out


def build_choices(answer: dict):
    """Return (choices_json, correct_answer_json) matching bank format."""
    style = answer.get("style", "")
    choices = answer.get("choices") or {}
    if choices:  # MCQ
        keys = [k for k in CHOICE_ORDER if k in choices]
        choices_json = [choices[k].get("body", "") for k in keys]
        correct = answer.get("correctChoice")
        idx = keys.index(correct) if correct in keys else 0
        return choices_json, {"index": idx}
    # SPR (student-produced response) — no choices
    correct = answer.get("correctChoice")
    answers = [correct] if correct is not None else []
    return None, {"answers": answers}


def build_prompt_html(item: dict) -> str:
    """Combine passage body + prompt into a single HTML blob (bank convention)."""
    parts = []
    passage = item.get("passage")
    if isinstance(passage, dict) and passage.get("body"):
        parts.append(passage["body"])
    if item.get("prompt"):
        parts.append(item["prompt"])
    return "\n".join(parts)


def resolve_skill_id(metadata: dict, skill_by_code: dict):
    """
    Map API metadata to a skill_id.
      - R/W: SECONDARY_CLASS_CD is the skill code (e.g. 'WIC', 'TRA').
      - Math: TERTIARY_CLASS_CD looks like 'H.A.2X'; the skill code is the
        leading 'LETTER.LETTER.' prefix (e.g. 'H.A.').
    Returns skill_id or None.
    """
    sec = metadata.get("SECONDARY_CLASS_CD")
    if sec and sec in skill_by_code:
        return skill_by_code[sec]
    tert = metadata.get("TERTIARY_CLASS_CD") or ""
    # math tertiary like H.A.2X -> prefix H.A.
    bits = tert.split(".")
    if len(bits) >= 2:
        prefix = f"{bits[0]}.{bits[1]}."
        if prefix in skill_by_code:
            return skill_by_code[prefix]
    return None


def upsert_question(
    db: Session,
    item: dict,
    section: str,
    domain_by_code: dict,
    skill_by_code: dict,
    stats: dict,
):
    """Insert or update a Question from an API item. Returns external_id."""
    ext = item["externalId"]
    answer = item["answer"]
    answer_type = AnswerType.MCQ if (answer.get("choices")) else AnswerType.SPR
    choices_json, correct_json = build_choices(answer)
    prompt_html = build_prompt_html(item)
    explanation = answer.get("rationale")
    meta = item.get("metadata", {}) or {}

    subject = SubjectArea.MATH if section == "math" else SubjectArea.READING_WRITING
    domain_id = domain_by_code.get(meta.get("PRIMARY_CLASS_CD"))
    skill_id = resolve_skill_id(meta, skill_by_code)

    raw = {
        "source": "mypractice_api",
        "questionId": item.get("questionId"),
        "vaultId": item.get("vaultId"),
        "metadata": meta,
        "section": section,
        "displayNumber": item.get("displayNumber"),
    }

    q = db.query(Question).filter(Question.external_id == ext).first()
    if q is None:
        q = Question(external_id=ext)
        db.add(q)
        stats["inserted"] += 1
    else:
        stats["updated"] += 1

    q.subject_area = subject
    q.answer_type = answer_type
    q.domain_id = domain_id
    q.skill_id = skill_id
    q.prompt_html = prompt_html
    q.choices_json = choices_json
    q.correct_answer_json = correct_json
    q.explanation_html = explanation
    q.is_active = True
    # Official CB content but no per-item difficulty/IRT in this payload
    q.is_verified = True
    q.raw_import_json = raw
    q.imported_at = datetime.now(timezone.utc)
    if skill_id is None:
        stats["no_skill"] += 1
    if domain_id is None:
        stats["no_domain"] += 1
    return ext


def split_modules(capture: dict):
    """
    From a single attempt's capture, return {section: (m1_ext[], m2_ext[])}.
    Module 1 = first SECTION_SIZE items by sequence; Module 2 = remainder.
    """
    out = {}
    for section, size in SECTION_SIZE.items():
        items = capture.get(section, [])
        m1 = [it["externalId"] for it in items[:size]]
        m2 = [it["externalId"] for it in items[size:]]
        out[section] = (m1, m2)
    return out


def import_test(db: Session, test_number: int, dry_run: bool):
    easier_file, harder_file = TEST_FILES[test_number]
    print(f"\n{'='*64}\nPractice Test {test_number}\n{'='*64}")
    easier = load_capture(easier_file)
    harder = load_capture(harder_file)

    # taxonomy lookups
    domain_by_code = {d.code: d.id for d in db.query(Domain).all()}
    skill_by_code = {s.code: s.id for s in db.query(Skill).all()}

    stats = {"inserted": 0, "updated": 0, "no_skill": 0, "no_domain": 0}

    # Upsert every unique question across BOTH attempts
    seen = set()
    for capture in (easier, harder):
        for section, items in capture.items():
            for it in items:
                if it["externalId"] in seen:
                    continue
                seen.add(it["externalId"])
                upsert_question(db, it, section, domain_by_code, skill_by_code, stats)

    print(f"  Questions: {stats['inserted']} inserted, {stats['updated']} updated, "
          f"{len(seen)} unique total")
    print(f"  Unmapped: {stats['no_skill']} without skill, "
          f"{stats['no_domain']} without domain")

    # Derive module question lists
    easier_modules = split_modules(easier)
    harder_modules = split_modules(harder)

    # Sanity: Module 1 must be identical across the two takes
    for section in SECTION_SIZE:
        e_m1 = easier_modules[section][0]
        h_m1 = harder_modules[section][0]
        if e_m1 != h_m1:
            print(f"  WARNING: {section} Module 1 differs between takes "
                  f"(easier {len(e_m1)} vs harder {len(h_m1)}); using easier-path M1.")

    # Build the module config: 3 modules per section
    module_configs = []
    for section, size in SECTION_SIZE.items():
        subject = SECTION_SUBJECT[section]
        time_limit = SECTION_TIME[section]
        m1 = easier_modules[section][0]          # shared Module 1
        m2_easier = easier_modules[section][1]
        m2_harder = harder_modules[section][1]
        module_configs += [
            (subject, 1, "module_1_standard", time_limit, m1),
            (subject, 2, "module_2_easier", time_limit, m2_easier),
            (subject, 2, "module_2_harder", time_limit, m2_harder),
        ]

    # Validate counts
    ok = True
    for subject, num, mtype, _t, uids in module_configs:
        expected = SECTION_SIZE["math"] if subject == "math" else SECTION_SIZE["reading"]
        flag = "" if len(uids) == expected else f"  <-- EXPECTED {expected}"
        if len(uids) != expected:
            ok = False
        print(f"  {subject:15} {mtype:18} {len(uids):3d} questions{flag}")
    if not ok:
        print("  ERROR: module count mismatch; not seeding this test.")
        return False

    if dry_run:
        print("  [dry-run] skipping DB write of practice_test/modules")
        return True

    # Replace the practice test
    existing = db.query(PracticeTest).filter(
        PracticeTest.test_number == test_number
    ).first()
    if existing:
        db.delete(existing)
        db.flush()
        print(f"  Removed existing Practice Test {test_number} (cascade modules)")

    pt = PracticeTest(
        test_number=test_number,
        test_name=f"SAT Practice Test {test_number}",
        description=(
            f"Official College Board Practice Test {test_number}, imported from the "
            f"MyPractice results API with full adaptive Module 2 variants."
        ),
        is_active=True,
        date_extracted=datetime.now(timezone.utc),
        note="Imported via import_from_mypractice_api.py from captured /questions responses.",
        test_metadata={
            "source": "mypractice_api",
            "captured": "2026-06-05",
            "easier_file": easier_file,
            "harder_file": harder_file,
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
    print(f"  Seeded Practice Test {test_number} with {len(module_configs)} modules")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tests", nargs="*", type=int, default=[4, 5, 6, 7],
                    help="Test numbers to import (default 4 5 6 7)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Parse and validate without writing practice_test/modules")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        all_ok = True
        for n in args.tests:
            if n not in TEST_FILES:
                print(f"Skipping PT{n}: no capture files configured.")
                continue
            ok = import_test(db, n, args.dry_run)
            all_ok = all_ok and ok
        if args.dry_run:
            db.rollback()
            print("\n[dry-run] rolled back all changes.")
        elif all_ok:
            db.commit()
            print("\nCommitted all imports.")
        else:
            db.rollback()
            print("\nValidation failed for at least one test; rolled back everything.")
            sys.exit(1)
    except Exception as e:
        db.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
