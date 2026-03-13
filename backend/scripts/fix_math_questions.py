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


def main():
    # math_norm.json is tracked in git and deployed to production
    # math_core.json is gitignored (too large) and only lives locally
    data_dir = Path(__file__).parent.parent / "data"
    norm_path = data_dir / "math_norm.json"

    if not norm_path.exists():
        print(f"ERROR: {norm_path} not found.")
        sys.exit(1)

    print(f"Loading {norm_path}...")
    with open(norm_path) as f:
        norm_list = json.load(f)

    norm_by_uid = {str(q["uId"]): q for q in norm_list}
    print(f"Loaded {len(norm_by_uid)} questions")

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
        print(f"\nDone. Updated: {updated} | Skipped (not in norm file): {skipped}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
