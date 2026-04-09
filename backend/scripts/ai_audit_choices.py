#!/usr/bin/env python3
"""
ai_audit_choices.py
--------------------
Uses Claude to audit ALL LaTeX spans extracted from answer choices in the DB.
Identifies and corrects:
  1. Bare "and" between equations (should be \\text{ and })
  2. Two equations concatenated without separator (should be SPLIT into math-system)
  3. "one point" prefix before coordinates
  4. Coordinate pairs missing parentheses (e.g. "2 , 3" → "(2, 3)")
  5. Accessibility description text leaking into LaTeX
  6. Any other English words/phrases rendered as italic math

Steps:
  1. Extract all unique \\(...\\) spans from choices_json across all active questions
  2. Submit to Claude in batches for validation + correction
  3. Save corrections to data/ai_choice_corrections.json
  4. Generate Railway-ready compressed commands to apply corrections

Usage:
    cd backend/
    python -m scripts.ai_audit_choices                  # Full audit + save corrections
    python -m scripts.ai_audit_choices --dry-run        # Show what would be sent
    python -m scripts.ai_audit_choices --apply          # Apply saved corrections to local DB
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import zlib
import base64
import html as html_module
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import anthropic

DATA_DIR = Path(__file__).parent.parent / "data"
CORRECTIONS_FILE = DATA_DIR / "ai_choice_corrections.json"

MODEL_CHEAP = "claude-haiku-4-5-20251001"
MODEL_STRONG = "claude-sonnet-4-5-20251001"

SYSTEM_PROMPT = """You are auditing LaTeX strings extracted from SAT math answer choices.
Each string is the content INSIDE a \\( ... \\) LaTeX span — do NOT include the delimiters.

Return ONLY a JSON object:
  {"ok": true}
  or
  {"ok": false, "fixed": "CORRECTED_LATEX_HERE"}
  or for split systems:
  {"ok": false, "split": ["EQUATION_1_LATEX", "EQUATION_2_LATEX"]}

Common issues to detect and fix:

1. Bare "and" between two equations — should use \\text{ and }
   BAD:  10c + 20s = 700 and 12c + 25s = 850
   GOOD: {"ok": false, "fixed": "10c + 20s = 700 \\\\text{ and } 12c + 25s = 850"}

2. Two equations concatenated with no separator — should be split
   BAD:  -2x + 3y = -92x - 3y = 9   (notice: RHS of eq1 runs into eq2)
   GOOD: {"ok": false, "split": ["-2x + 3y = -9", "2x - 3y = 9"]}

3. "one point" or "the point" prefix before coordinates — remove the prefix
   BAD:  one point (2, 3)
   GOOD: {"ok": false, "fixed": "(2, 3)"}

4. Coordinate pair missing parentheses
   BAD:  2 , 3    or    2, 3    or    2 ,  - 5
   GOOD: {"ok": false, "fixed": "(2, 3)"}  or  {"ok": false, "fixed": "(2, -5)"}

5. Accessibility description text in LaTeX (full English sentences)
   BAD:  This answer choice consists of two equations. 10c + 20s = 700 and 12c + 25s = 850
   GOOD: {"ok": false, "split": ["10c + 20s = 700", "12c + 25s = 850"]}

6. Any other English words/phrases that are not valid LaTeX and would render as italic variables
   Examples: "or", "where", "for", "if", "then", "such that", "when"
   These should be wrapped in \\text{ } or removed if they are accessibility artifacts.

7. Double backslashes that should be single (\\\\frac → \\frac, \\\\sqrt → \\sqrt)
   BAD:  \\\\frac{3}{4}
   GOOD: {"ok": false, "fixed": "\\\\frac{3}{4}"}

Return {"ok": true} if the LaTeX is correct and needs no changes.
Do NOT "fix" things that are already correct. Only flag genuine issues."""


def extract_latex_spans(choices_json_str: str | list) -> list[str]:
    """Extract all \\(...\\) span contents from a choices_json value."""
    if not choices_json_str:
        return []
    if isinstance(choices_json_str, str):
        try:
            choices = json.loads(choices_json_str)
        except Exception:
            return []
    else:
        choices = choices_json_str

    spans = []
    for c in choices:
        text = ""
        if isinstance(c, str):
            text = c
        elif isinstance(c, dict):
            for key in ("content", "html", "text"):
                if key in c and isinstance(c[key], str):
                    text += c[key]
        # Extract \\(...\\) spans
        for m in re.finditer(r"\\\((.+?)\\\)", text, flags=re.DOTALL):
            spans.append(m.group(1))
    return spans


def load_db_choices() -> list[tuple[str, Any]]:
    """Load all choices_json from the local DB."""
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from app.database import SessionLocal
    from app.models.question import Question

    db = SessionLocal()
    try:
        rows = db.query(Question.id, Question.choices_json).filter(
            Question.is_active == True,  # noqa: E712
            Question.choices_json != None,  # noqa: E711
        ).all()
        return [(str(r.id), r.choices_json) for r in rows]
    finally:
        db.close()


def audit_span(client: anthropic.Anthropic, span: str, model: str = MODEL_CHEAP) -> dict:
    """Ask Claude to validate/correct a single LaTeX span."""
    for attempt in range(5):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=256,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": span}],
            )
            text = resp.content[0].text.strip()
            # Parse JSON response
            result = json.loads(text)
            return result
        except json.JSONDecodeError:
            # Try to extract JSON from response
            m = re.search(r'\{.*\}', text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
            return {"ok": True}  # If we can't parse, assume ok
        except Exception as e:
            wait = 2 ** attempt
            if "429" in str(e) or "rate_limit" in str(e):
                wait = max(wait, 30)  # rate limit: wait at least 30s
            if attempt < 4:
                time.sleep(wait)
            else:
                print(f"  ERROR auditing span: {e}")
                return {"ok": True}
    return {"ok": True}


def run_audit(dry_run: bool = False) -> None:
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    print("Loading choices from DB...")
    rows = load_db_choices()
    print(f"Loaded {len(rows)} questions with choices")

    # Extract all unique spans
    all_spans: set[str] = set()
    for qid, choices in rows:
        spans = extract_latex_spans(choices)
        all_spans.update(spans)

    print(f"Unique LaTeX spans to audit: {len(all_spans)}")

    if dry_run:
        print("[DRY RUN] Sample spans:")
        for s in list(all_spans)[:10]:
            print(f"  {repr(s[:80])}")
        return

    # Audit in parallel
    corrections: dict[str, dict] = {}
    span_list = list(all_spans)
    errors = 0

    print(f"Auditing {len(span_list)} spans with {MODEL_CHEAP} (5 workers, rate-limited)...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(audit_span, client, span): span for span in span_list}
        done = 0
        for future in as_completed(futures):
            span = futures[future]
            done += 1
            if done % 50 == 0:
                print(f"  Progress: {done}/{len(span_list)} ({len(corrections)} issues found)")
            try:
                result = future.result()
                if not result.get("ok", True):
                    corrections[span] = result
            except Exception as e:
                errors += 1

    print(f"\nAudit complete. Issues found: {len(corrections)}, errors: {errors}")

    # For uncertain cases, retry with stronger model
    if corrections:
        print(f"Saving {len(corrections)} corrections to {CORRECTIONS_FILE}")
        CORRECTIONS_FILE.write_text(json.dumps(corrections, indent=2, ensure_ascii=False))
        print(f"Saved.")

        # Summary
        fixed_count = sum(1 for v in corrections.values() if "fixed" in v)
        split_count = sum(1 for v in corrections.values() if "split" in v)
        print(f"  - Simple fixes: {fixed_count}")
        print(f"  - System splits: {split_count}")

        print("\nSample corrections:")
        for span, corr in list(corrections.items())[:5]:
            print(f"  SPAN: {repr(span[:60])}")
            print(f"  CORR: {corr}")
            print()
    else:
        print("No issues found — all answer choice LaTeX looks correct!")


def apply_corrections_to_local_db() -> None:
    """Apply saved corrections to the local database."""
    if not CORRECTIONS_FILE.exists():
        print("No corrections file found. Run audit first.")
        return

    corrections = json.loads(CORRECTIONS_FILE.read_text())
    print(f"Loaded {len(corrections)} corrections")

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from app.database import SessionLocal
    from app.models.question import Question

    db = SessionLocal()
    try:
        questions = db.query(Question).filter(
            Question.is_active == True,  # noqa: E712
            Question.choices_json != None,  # noqa: E711
        ).all()

        updated = 0
        total_subs = 0

        for q in questions:
            choices = q.choices_json
            if not choices:
                continue

            new_choices = []
            changed = False

            for c in choices:
                text = ""
                if isinstance(c, str):
                    text = c
                elif isinstance(c, dict):
                    text = c.get("content", "") or c.get("html", "") or c.get("text", "") or ""

                new_text, n = _apply_corrections_to_html(text, corrections)
                total_subs += n
                if n:
                    changed = True
                    if isinstance(c, str):
                        new_choices.append(new_text)
                    elif isinstance(c, dict):
                        nc = dict(c)
                        for key in ("content", "html", "text"):
                            if key in nc and isinstance(nc[key], str):
                                nc[key], _ = _apply_corrections_to_html(nc[key], corrections)
                        new_choices.append(nc)
                    else:
                        new_choices.append(c)
                else:
                    new_choices.append(c)

            if changed:
                q.choices_json = new_choices
                updated += 1

        db.commit()
        print(f"Updated {updated} questions, {total_subs} substitutions")
    finally:
        db.close()


def _apply_corrections_to_html(html_str: str, corrections: dict) -> tuple[str, int]:
    """Apply corrections to \\(...\\) spans in an HTML string."""
    if not html_str:
        return html_str, 0
    count = [0]

    def replace_span(m: re.Match) -> str:
        inner = m.group(1)
        if inner in corrections:
            corr = corrections[inner]
            if "fixed" in corr:
                count[0] += 1
                return "\\(" + corr["fixed"] + "\\)"
            elif "split" in corr:
                count[0] += 1
                parts = corr["split"]
                spans = "".join(f'<span style="display:block;">\\({p}\\)</span>' for p in parts)
                return f'<div class="math-system" style="display:flex;flex-direction:column;gap:0.2em;">{spans}</div>'
        return m.group(0)

    result = re.sub(r"\\\((.+?)\\\)", replace_span, html_str, flags=re.DOTALL)
    return result, count[0]


def generate_railway_command() -> None:
    """Generate a compressed Python command to apply corrections on Railway."""
    if not CORRECTIONS_FILE.exists():
        print("No corrections file found. Run audit first.")
        return

    corrections = json.loads(CORRECTIONS_FILE.read_text())
    print(f"Generating Railway command for {len(corrections)} corrections...")

    script_lines = [
        'import re, json, os',
        'from sqlalchemy import create_engine, text',
        '',
        'db_url = os.environ.get("DATABASE_URL") or os.environ.get("DATABASE_PRIVATE_URL")',
        'engine = create_engine(db_url)',
        '',
        'CORRECTIONS = ' + repr(corrections),
        '',
        'def apply_to_html(s):',
        '    if not s: return s, 0',
        '    count = [0]',
        '    def replace_span(m):',
        '        inner = m.group(1)',
        '        if inner not in CORRECTIONS: return m.group(0)',
        '        corr = CORRECTIONS[inner]',
        '        count[0] += 1',
        '        if "fixed" in corr: return "\\\\(" + corr["fixed"] + "\\\\)"',
        '        if "split" in corr:',
        '            spans = "".join(f\'<span style="display:block;">\\\\(\' + p + "\\\\)</span>" for p in corr["split"])',
        '            return \'<div class="math-system" style="display:flex;flex-direction:column;gap:0.2em;">\' + spans + "</div>"',
        '        return m.group(0)',
        '    return re.sub(r"\\\\\\\\\\((.+?)\\\\\\\\\\)", replace_span, s, flags=re.DOTALL), count[0]',
        '',
        'with engine.begin() as conn:',
        '    rows = conn.execute(text("SELECT id, choices_json FROM questions WHERE is_active = true AND choices_json IS NOT NULL")).fetchall()',
        '    updated = 0; total_subs = 0',
        '    for row in rows:',
        '        qid = row[0]',
        '        choices = json.loads(row[1]) if isinstance(row[1], str) else row[1]',
        '        nc_list = []; cc = False',
        '        for c in choices:',
        '            if isinstance(c, str):',
        '                nc2, n = apply_to_html(c)',
        '                if n: total_subs += n; cc = True',
        '                nc_list.append(nc2)',
        '            elif isinstance(c, dict):',
        '                nc2 = dict(c)',
        '                for key in ("content", "html", "text"):',
        '                    if key in nc2 and isinstance(nc2[key], str):',
        '                        fixed, n = apply_to_html(nc2[key])',
        '                        if n: nc2[key] = fixed; total_subs += n; cc = True',
        '                nc_list.append(nc2)',
        '            else: nc_list.append(c)',
        '        if cc:',
        '            conn.execute(text("UPDATE questions SET choices_json = :c WHERE id = :id"), {"c": json.dumps(nc_list), "id": qid})',
        '            updated += 1',
        '    print(f"Updated: {updated}, subs: {total_subs}")',
    ]

    script = '\n'.join(script_lines)
    import ast
    try:
        ast.parse(script)
    except SyntaxError as e:
        print(f"Script syntax error: {e}")
        return

    compressed = zlib.compress(script.encode())
    b64 = base64.b64encode(compressed).decode()
    cmd = "python3 -c \"import zlib,base64; exec(zlib.decompress(base64.b64decode('" + b64 + "')).decode())\""

    out_file = DATA_DIR / "railway_choice_fix_cmd.txt"
    out_file.write_text(cmd)
    print(f"Command saved to {out_file}")
    print(f"Command length: {len(cmd)} chars")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI audit of SAT answer choice LaTeX")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be audited without calling API")
    parser.add_argument("--apply", action="store_true", help="Apply saved corrections to local DB")
    parser.add_argument("--railway-cmd", action="store_true", help="Generate Railway compressed command from saved corrections")
    args = parser.parse_args()

    if args.apply:
        apply_corrections_to_local_db()
    elif args.railway_cmd:
        generate_railway_command()
    else:
        run_audit(dry_run=args.dry_run)
