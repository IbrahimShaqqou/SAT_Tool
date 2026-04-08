#!/usr/bin/env python3
"""
fix_bad_entries.py

Directly identifies and fixes all remaining bad LaTeX entries in math_alt_cache.json.

Usage:
    cd backend/
    python -m scripts.fix_bad_entries          # Identify + fix all bad entries
    python -m scripts.fix_bad_entries --identify-only  # Just print bad entries
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import anthropic

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "math_alt_cache.json"
CORRECTIONS_FILE = DATA_DIR / "ai_audit_corrections.json"

MODEL = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-5-20251001"

SYSTEM_PROMPT = """You are a math LaTeX validator. You will be given College Board SAT math alt-text descriptions (English descriptions of math expressions that appear in SAT questions) paired with their automated LaTeX translations.

Your job is to determine if the LaTeX translation is CORRECT or INCORRECT.

Rules:
- The alt text uses College Board's verbal description format (e.g., "x to the second power" = x², "the fraction 3 over 4" = 3/4)
- The LaTeX should faithfully represent the math expression described
- Minor formatting differences are OK (e.g., \\times vs ·, spaces)
- \\ percent (\\%) is correct for "percent"
- Chained inequalities like "0 < a < b" are correct for "0 is less than a, which is less than b"
- Text descriptions that are full sentences (not just math) may produce text-like LaTeX output — that's acceptable

Respond with ONLY a JSON object:
{"correct": true}  or  {"correct": false, "corrected": "THE_CORRECT_LATEX_HERE"}

When providing corrected LaTeX:
- Use standard LaTeX math syntax
- Do NOT wrap in \\( \\) delimiters
- Use \\frac{}{}, \\sqrt{}, ^{}, _{}, \\times, \\leq, \\geq, \\neq, \\approx, \\%, etc.
- Keep it minimal — just the math expression"""


def load_cache() -> dict[str, str]:
    return json.loads(CACHE_FILE.read_text())


def save_cache(cache: dict[str, str]) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def interesting_entries(cache: dict[str, str]) -> list[tuple[str, str]]:
    results = []
    for alt, latex in cache.items():
        if alt == latex:
            continue
        if len(alt) < 15:
            continue
        if not re.search(r"[=+\-*/^]|\\frac|\\sqrt|\\times|\\leq|\\geq|\\neq|\\approx|\^{|_{|\\%", latex):
            if not re.search(r"\b(fraction|power|squared|cubed|root|equals|plus|minus|times|over)\b", alt, re.I):
                continue
        results.append((alt, latex))
    return results


def parse_response_text(text: str) -> tuple[bool, str | None]:
    try:
        text = text.strip()
        if not text.startswith("{"):
            text = '{"correct": false, "corrected": "' + text
        if not text.endswith("}"):
            if '"corrected"' in text and not text.endswith('"}'):
                text = text.rstrip('",') + '"}'
        data = json.loads(text)
        is_correct = data.get("correct", True)
        corrected = data.get("corrected") or None
        return is_correct, corrected
    except json.JSONDecodeError:
        m = re.search(r'"correct"\s*:\s*(true|false)', text, re.I)
        if m and m.group(1).lower() == "false":
            corr_m = re.search(r'"corrected"\s*:\s*"(.+?)"(?:\s*})?$', text)
            corrected = corr_m.group(1) if corr_m else None
            return False, corrected
        return True, None


def call_api(client: anthropic.Anthropic, model: str, messages: list[dict],
             max_tokens: int = 300, retries: int = 3) -> str | None:
    for attempt in range(retries):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=SYSTEM_PROMPT,
                messages=messages,
            )
            return resp.content[0].text if resp.content else None
        except anthropic.RateLimitError:
            import time; time.sleep(2 ** attempt)
        except Exception:
            if attempt < retries - 1:
                import time; time.sleep(1)
    return None


# --- Rule-based fixes ---

def apply_rule_fixes(latex: str) -> str:
    """Apply deterministic fixes for known systematic patterns."""
    # Fix double-escaped cases environments
    latex = re.sub(r'\\\\begin\{cases\}', r'\\begin{cases}', latex)
    latex = re.sub(r'\\\\end\{cases\}', r'\\end{cases}', latex)
    latex = re.sub(r'\\\\\\\\(\s*\\n|\s*\n)', r'\\\\\n', latex)

    # Fix space-as-thousands-separator: "1 300" → "1{,}300"
    # Match digit(s) followed by groups of exactly 3 digits separated by spaces
    def fix_thousands(m):
        return m.group(0).replace(' ', '{,}')
    latex = re.sub(r'\b\d{1,3}( \d{3})+\b', fix_thousands, latex)

    return latex


def identify_bad_entries(client: anthropic.Anthropic, cache: dict,
                          workers: int = 50) -> list[dict]:
    """Run validation pass and return all flagged-as-bad entries."""
    entries = interesting_entries(cache)
    print(f"Scanning {len(entries)} entries with {workers} workers...")

    bad: list[dict] = []
    lock = threading.Lock()
    done = [0]

    def validate(alt: str, latex: str):
        text = call_api(client, MODEL, [
            {"role": "user", "content": f"Alt text: {alt}\nLaTeX: {latex}"}
        ], max_tokens=200)
        with lock:
            done[0] += 1
            if done[0] % 100 == 0:
                print(f"  {done[0]}/{len(entries)}...", flush=True)
        if text is None:
            return
        is_correct, corrected = parse_response_text(text)
        if not is_correct:
            with lock:
                bad.append({"alt": alt, "latex": latex, "corrected": corrected})

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [ex.submit(validate, alt, latex) for alt, latex in entries]
        for f in as_completed(futures):
            f.result()

    print(f"  Done. Found {len(bad)} bad entries.")
    return bad


def fix_entry_sonnet(client: anthropic.Anthropic, alt: str, bad_latex: str) -> str | None:
    """Ask Sonnet to reconstruct correct LaTeX from scratch."""
    text = call_api(client, SONNET, [
        {"role": "user", "content": (
            f"The LaTeX translation below is INCORRECT. "
            f"Write the correct LaTeX based ONLY on the alt text. "
            f"You MUST provide a corrected value — do not return {{\"correct\": false}} without a \"corrected\" field.\n\n"
            f"Alt text: {alt}\n"
            f"Bad LaTeX (for reference only): {bad_latex}\n\n"
            f'Respond with exactly: {{"correct": false, "corrected": "YOUR_LATEX_HERE"}}'
        )}
    ], max_tokens=400)
    if not text:
        return None
    _, corrected = parse_response_text(text)
    return corrected


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--identify-only", action="store_true")
    parser.add_argument("--workers", type=int, default=50)
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set ANTHROPIC_API_KEY")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    cache = load_cache()

    # Step 1: identify bad entries
    bad_entries = identify_bad_entries(client, cache, workers=args.workers)

    if not bad_entries:
        print("No bad entries found — cache is clean!")
        return

    print(f"\n{'='*60}")
    print(f"Bad entries found: {len(bad_entries)}")
    for i, e in enumerate(bad_entries):
        print(f"\n[{i+1}] ALT: {e['alt'][:80]!r}")
        print(f"     BAD: {e['latex']!r}")
        if e.get("corrected"):
            print(f"     INLINE FIX: {e['corrected']!r}")

    if args.identify_only:
        # Save for inspection
        Path("/tmp/bad_entries.json").write_text(
            json.dumps(bad_entries, ensure_ascii=False, indent=2)
        )
        print(f"\nSaved to /tmp/bad_entries.json")
        return

    # Step 2a: Rule-based fixes
    print(f"\n--- Applying rule-based fixes ---")
    rule_fixed = 0
    still_bad: list[dict] = []
    for e in bad_entries:
        alt, bad_latex = e["alt"], e["latex"]

        # Use inline correction if available
        if e.get("corrected"):
            cache[alt] = e["corrected"]
            print(f"  INLINE: {alt[:50]!r}")
            print(f"    → {e['corrected']!r}")
            rule_fixed += 1
            continue

        fixed = apply_rule_fixes(bad_latex)
        if fixed != bad_latex:
            cache[alt] = fixed
            print(f"  RULE:   {alt[:50]!r}")
            print(f"    OLD: {bad_latex!r}")
            print(f"    NEW: {fixed!r}")
            rule_fixed += 1
        else:
            still_bad.append(e)

    print(f"\nRule-based: {rule_fixed} fixed, {len(still_bad)} still need AI")

    # Step 2b: Sonnet for remaining
    if still_bad:
        print(f"\n--- Sonnet reconstruction for {len(still_bad)} entries ---")
        sonnet_fixed = [0]
        no_fix: list[dict] = []
        lock = threading.Lock()

        def fix_one(e):
            corrected = fix_entry_sonnet(client, e["alt"], e["latex"])
            with lock:
                if corrected:
                    cache[e["alt"]] = corrected
                    print(f"  SONNET: {e['alt'][:50]!r}")
                    print(f"    OLD: {e['latex']!r}")
                    print(f"    NEW: {corrected!r}")
                    sonnet_fixed[0] += 1
                else:
                    no_fix.append(e)

        with ThreadPoolExecutor(max_workers=20) as ex:
            list(as_completed([ex.submit(fix_one, e) for e in still_bad]))

        if no_fix:
            print(f"\n  {len(no_fix)} entries could not be fixed automatically:")
            for e in no_fix:
                print(f"    - {e['alt'][:70]!r}")
                print(f"      {e['latex']!r}")

    # Save
    save_cache(cache)
    total_fixed = len(bad_entries) - len(still_bad if still_bad else [])
    print(f"\nCache updated. Run: python -m scripts.normalize_questions --repatch")


if __name__ == "__main__":
    main()
