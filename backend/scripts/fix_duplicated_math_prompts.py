#!/usr/bin/env python3
"""
One-time backfill: strip duplicated MathML stimulus from math question prompts.

Problem:
  question_import.py used to unconditionally prepend `stimulus_html` onto
  `prompt_html`. For College Board math questions, the same equation
  appears in both fields — as MathML in stimulus_html and as LaTeX in
  prompt_html. The stored `prompt_html` therefore contained the equation
  twice and rendered it as both MathML and LaTeX on every surface.

Fix:
  For math questions whose stimulus is MathML-only (no img/svg/table/
  figure/text — anything that adds info beyond the LaTeX equation already
  in prompt_html), rebuild prompt_html from the raw prompt without the
  duplicated stimulus prepended.

  Math questions whose stimulus carries non-MathML visual content (graphs
  as img or svg, tables, etc.) are left alone — that content belongs above
  the prompt and isn't represented in prompt_html.

  Reading & Writing questions are left alone — the stimulus is the passage
  and is meant to render above the prompt in question-bank surfaces.

Run once after deploying the question_import.py fix:
    python scripts/fix_duplicated_math_prompts.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.question import Question
from app.models.enums import SubjectArea
from app.services.question_import import is_mathml_only_stimulus


def main():
    db = SessionLocal()
    updated = 0
    visual_skipped = 0
    no_stimulus_skipped = 0
    no_raw_prompt_skipped = 0
    already_clean = 0

    try:
        questions = (
            db.query(Question)
            .filter(Question.subject_area == SubjectArea.MATH)
            .all()
        )

        print(f"Checking {len(questions)} math questions...")

        for q in questions:
            raw = q.raw_import_json
            if not raw or not isinstance(raw, dict):
                no_stimulus_skipped += 1
                continue

            stimulus = raw.get("stimulus_html") or ""
            raw_prompt = raw.get("prompt_html") or ""

            if not stimulus:
                no_stimulus_skipped += 1
                continue

            if not is_mathml_only_stimulus(stimulus):
                # Non-MathML visual content (img, svg, table, figure, text):
                # legitimately prepended, leave alone.
                visual_skipped += 1
                continue

            if not raw_prompt:
                no_raw_prompt_skipped += 1
                continue

            # Only update if stimulus is currently prepended in prompt_html
            current = q.prompt_html or ""
            if not current.startswith(stimulus):
                already_clean += 1
                continue

            q.prompt_html = raw_prompt
            updated += 1

            if updated % 100 == 0:
                db.commit()
                print(f"  {updated} updated...")

        db.commit()

        print()
        print("Done.")
        print(f"  Updated:                   {updated}")
        print(f"  Skipped (visual stimulus): {visual_skipped}")
        print(f"  Skipped (no stimulus):     {no_stimulus_skipped}")
        print(f"  Skipped (no raw prompt):   {no_raw_prompt_skipped}")
        print(f"  Already clean:             {already_clean}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
