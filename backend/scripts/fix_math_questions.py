#!/usr/bin/env python3
"""
One-time migration: fix math questions with missing explanations or wrong correct-answer index.

Problems fixed:
  - 459 questions had no explanation because rationale was in answer.rationale, not detail.rationale
  - 11 MCQ questions had correct_answer_json = {"index": -1} because the correct answer was
    only discoverable from the rationale text ("Choice B is correct")

Run once after deploying the fetch_math.py fix:
    python scripts/fix_math_questions.py
"""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.question import Question
from scripts.fetch_math import normalize


def main():
    data_dir = Path(__file__).parent.parent / "data"
    core_path = data_dir / "math_core.json"

    if not core_path.exists():
        print(f"ERROR: {core_path} not found. Run fetch_math.py first.")
        sys.exit(1)

    print(f"Loading {core_path}...")
    with open(core_path) as f:
        core = json.load(f)

    print(f"Re-normalizing {len(core)} questions...")
    normalized = {r["uId"]: normalize(rec) for rec in core.values() for r in [normalize(rec)]}
    # Rebuild as uid -> norm dict properly
    norm_by_uid = {}
    for rec in core.values():
        n = normalize(rec)
        norm_by_uid[str(n["uId"])] = n

    db = SessionLocal()
    updated = 0
    skipped = 0

    try:
        questions = db.query(Question).filter(
            Question.subject_area == "MATH"
        ).all()

        print(f"Checking {len(questions)} math questions in DB...")

        for q in questions:
            norm = norm_by_uid.get(q.external_id)
            if not norm:
                skipped += 1
                continue

            changed = False

            # Fix missing explanation
            new_expl = norm.get("rationale_html", "").strip() or None
            if new_expl and not q.explanation_html:
                q.explanation_html = new_expl
                changed = True

            # Fix bad correct answer index
            new_correct = norm.get("correct", {})
            old_correct = q.correct_answer_json or {}
            if (
                q.answer_type.value == "MCQ"
                and old_correct.get("index", -1) == -1
                and new_correct.get("index", -1) >= 0
            ):
                q.correct_answer_json = new_correct
                changed = True

            if changed:
                updated += 1

        db.commit()
        print(f"\nDone. Updated: {updated} | Skipped (not in core): {skipped}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
