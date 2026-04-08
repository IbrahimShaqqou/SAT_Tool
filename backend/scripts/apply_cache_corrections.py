#!/usr/bin/env python3
"""
apply_cache_corrections.py

Apply corrected math_alt_cache.json values to already-migrated DB questions.
Finds LaTeX spans containing old incorrect LaTeX and replaces with corrected versions.

Usage:
    cd backend/
    python -m scripts.apply_cache_corrections --dry-run   # Preview changes
    python -m scripts.apply_cache_corrections              # Apply changes
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.database import SessionLocal
from app.models.question import Question

DATA_DIR = Path(__file__).parent.parent / "data"
# Pre-computed replacement pairs (generated locally via build_replacements_file())
REPLACEMENTS_FILE = DATA_DIR / "latex_span_replacements.json"


def latex_to_html_text(latex: str) -> str:
    """Convert a LaTeX string to the HTML-text form as stored by BeautifulSoup."""
    # BS4 escapes < > & in tag text
    return html.escape(latex, quote=False)


def apply_corrections_to_html(html_str: str, replacements: list[tuple[str, str]]) -> tuple[str, int]:
    """
    Apply (old_html_text, new_html_text) replacements inside \\(…\\) spans.
    Returns (new_html, count_of_changes).
    """
    if not html_str:
        return html_str, 0

    count = [0]

    def replace_span(m: re.Match) -> str:
        inner = m.group(1)
        for old_inner, new_inner in replacements:
            if old_inner in inner:
                inner = inner.replace(old_inner, new_inner, 1)
                count[0] += 1
        return f"\\({inner}\\)"

    new_html = re.sub(r"\\\((.+?)\\\)", replace_span, html_str, flags=re.DOTALL)
    return new_html, count[0]


def run(dry_run: bool = False) -> None:
    print("Loading replacement pairs...")
    raw_pairs = json.loads(REPLACEMENTS_FILE.read_text())
    pairs = [tuple(p) for p in raw_pairs]
    print(f"  {len(pairs)} replacement pairs loaded")

    db = SessionLocal()
    try:
        questions = db.query(Question).filter(Question.is_active == True).all()
        total = len(questions)
        print(f"  {total} active questions\n")

        updated = 0
        total_subs = 0

        for i, q in enumerate(questions):
            changed = False

            # prompt_html
            if q.prompt_html:
                new_html, n = apply_corrections_to_html(q.prompt_html, pairs)
                if n > 0:
                    if dry_run:
                        print(f"  [DRY] q={q.external_id} prompt: {n} change(s)")
                    else:
                        q.prompt_html = new_html
                    total_subs += n
                    changed = True

            # choices_json
            if q.choices_json:
                choices = q.choices_json if isinstance(q.choices_json, list) else json.loads(q.choices_json or "[]")
                new_choices = []
                choice_changed = False
                for c in choices:
                    if isinstance(c, str):
                        new_c, n = apply_corrections_to_html(c, pairs)
                    elif isinstance(c, dict):
                        new_c = dict(c)
                        for key in ("content", "html", "text"):
                            if key in new_c and isinstance(new_c[key], str):
                                fixed, n = apply_corrections_to_html(new_c[key], pairs)
                                if n > 0:
                                    new_c[key] = fixed
                                    total_subs += n
                                    choice_changed = True
                        new_choices.append(new_c)
                        continue
                    else:
                        new_choices.append(c)
                        continue

                    if n > 0:
                        total_subs += n
                        choice_changed = True
                    new_choices.append(new_c)

                if choice_changed:
                    if not dry_run:
                        q.choices_json = new_choices
                    changed = True

            # explanation_html
            if q.explanation_html:
                new_html, n = apply_corrections_to_html(q.explanation_html, pairs)
                if n > 0:
                    if dry_run:
                        print(f"  [DRY] q={q.external_id} explanation: {n} change(s)")
                    else:
                        q.explanation_html = new_html
                    total_subs += n
                    changed = True

            if changed:
                updated += 1

            if not dry_run and (i + 1) % 500 == 0:
                db.commit()
                print(f"  {i+1}/{total} committed ({updated} updated so far)...")

        if not dry_run:
            db.commit()

        print(f"\n{'DRY RUN — ' if dry_run else ''}Done.")
        print(f"  Questions updated : {updated}")
        print(f"  Total substitutions: {total_subs}")
        print(f"  Questions clean   : {total - updated}")

    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = ap.parse_args()
    run(dry_run=args.dry_run)
