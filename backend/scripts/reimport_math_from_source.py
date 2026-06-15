"""
Re-import math question content deterministically from the College Board source
(data/math_core.json), replacing the AI/regex-mangled LaTeX currently in the DB.

The source carries exact, structured MathML. We render it directly (MathJax
handles MathML) instead of reconstructing math from the human `alttext` — that
reconstruction is what introduced errors (spurious ×, bad fractions).

Join: source top-level dict UUID key  ==  Question.external_id  (verified ~96%).
Updates in place; never creates rows. Idempotent.

Usage:
    python -m scripts.reimport_math_from_source            # DRY RUN (default)
    python -m scripts.reimport_math_from_source --apply    # write changes
    python -m scripts.reimport_math_from_source --apply --limit 50

See docs/superpowers/specs/2026-06-14-deterministic-math-reimport-design.md
"""

import argparse
import json
from pathlib import Path
from typing import Optional

from app.database import SessionLocal
from app.models.question import Question
from app.models.enums import AnswerType
from app.services.question_content import extract_from_source

DATA_DIR = Path(__file__).parent.parent / "data"
SOURCE = DATA_DIR / "math_core.json"


def _snippet(s: str, n: int = 90) -> str:
    s = (s or "").replace("\n", " ")
    return s[:n] + ("…" if len(s) > n else "")


def run(apply: bool, limit: Optional[int], show: int):
    source = json.loads(SOURCE.read_text())
    db = SessionLocal()
    try:
        # Index DB math questions by external_id for an in-memory join.
        db_by_ext = {
            q.external_id: q
            for q in db.query(Question).filter(Question.subject_area == "math").all()
        }

        stats = {
            "source": len(source), "matched": 0, "unmatched": 0,
            "extract_fail": 0, "updated": 0, "unchanged": 0,
            "mcq": 0, "spr": 0,
        }
        shown = 0
        processed = 0

        for ext_id, entry in source.items():
            if limit is not None and processed >= limit:
                break
            q = db_by_ext.get(ext_id)
            if q is None:
                stats["unmatched"] += 1
                continue
            stats["matched"] += 1
            processed += 1

            fields = extract_from_source(entry)
            if not fields:
                stats["extract_fail"] += 1
                continue

            stats["mcq" if fields["answer_type"] == "MCQ" else "spr"] += 1
            changed = (
                q.prompt_html != fields["prompt_html"]
                or q.choices_json != fields["choices_json"]
                or q.correct_answer_json != fields["correct_answer_json"]
                or q.explanation_html != fields["explanation_html"]
            )
            if not changed:
                stats["unchanged"] += 1
                continue
            stats["updated"] += 1

            if shown < show:
                shown += 1
                print(f"\n--- {ext_id} [{fields['answer_type']}] ---")
                print(f"  OLD prompt: {_snippet(q.prompt_html)}")
                print(f"  NEW prompt: {_snippet(fields['prompt_html'])}")

            if apply:
                q.prompt_html = fields["prompt_html"]
                q.choices_json = fields["choices_json"]
                q.correct_answer_json = fields["correct_answer_json"]
                q.explanation_html = fields["explanation_html"]
                q.answer_type = AnswerType(fields["answer_type"])

        if apply:
            db.commit()
            print("\n[APPLIED] changes committed.")
        else:
            db.rollback()
            print("\n[DRY RUN] no changes written. Re-run with --apply to commit.")

        print("\n=== summary ===")
        for k, v in stats.items():
            print(f"  {k}: {v}")
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--limit", type=int, default=None, help="cap questions processed")
    ap.add_argument("--show", type=int, default=8, help="how many before/after diffs to print")
    args = ap.parse_args()
    run(apply=args.apply, limit=args.limit, show=args.show)
