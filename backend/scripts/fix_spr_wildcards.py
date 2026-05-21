#!/usr/bin/env python3
"""
Fix SPR questions with wildcard (*) answers by extracting the real answer
from College Board's disclosed rationale text.

Usage:
    python scripts/fix_spr_wildcards.py          # dry run
    python scripts/fix_spr_wildcards.py --apply   # write to DB
"""
import argparse
import re
import sys
import time
import json
import requests
from fractions import Fraction

sys.path.insert(0, ".")
from app.database import SessionLocal
from app.models.question import Question
from app.models.enums import AnswerType

DISC_BASE = "https://saic.collegeboard.org/disclosed"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Origin": "https://satsuitequestionbank.collegeboard.org",
    "Referer": "https://satsuitequestionbank.collegeboard.org/",
}


WORD_TO_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "twenty-five": 25, "thirty": 30, "forty": 40, "fifty": 50,
}


def _parse_alt_fraction(alt: str):
    """Parse img alt text like 'one half', 'seven over 6', 'the fraction 10 over 3'."""
    alt = alt.strip().lower()
    alt = re.sub(r"^the fraction\s+", "", alt)

    # "X over Y" or "X halves/thirds/quarters/fifths/sixths"
    m = re.match(r"(.+?)\s+over\s+(.+)", alt)
    if m:
        num_s, den_s = m.group(1).strip(), m.group(2).strip()
        num = WORD_TO_NUM.get(num_s, num_s)
        den = WORD_TO_NUM.get(den_s, den_s)
        try:
            return f"{int(num)}/{int(den)}"
        except ValueError:
            pass

    # "X halves" style
    denom_words = {"half": 2, "halves": 2, "third": 3, "thirds": 3,
                   "quarter": 4, "quarters": 4, "fourth": 4, "fourths": 4,
                   "fifth": 5, "fifths": 5, "sixth": 6, "sixths": 6,
                   "seventh": 7, "sevenths": 7, "eighth": 8, "eighths": 8}
    for word, d in denom_words.items():
        m2 = re.match(rf"(.+?)\s+{word}$", alt)
        if m2:
            num_s = m2.group(1).strip()
            num = WORD_TO_NUM.get(num_s, num_s)
            try:
                return f"{int(num)}/{d}"
            except ValueError:
                pass

    return None


def extract_answer_from_rationale(rationale: str):
    """
    Parse the numeric answer from CB rationale text.

    Handles:
      - Plain text: "The correct answer is 3,540."
      - Fractions: "The correct answer is 7/2."
      - Multiple: "The correct answer is either 8 or 9."
      - Image alt text: "The correct answer is <img alt='one half'>."
    """
    if not rationale:
        return None

    # --- Step 1: Find the "correct answer is ..." chunk from raw HTML ---
    # Grab everything after "correct answer is" up to the first period that's
    # outside an HTML tag, or to </p>
    m = re.search(
        r"correct answer is\s+(.*?)(?:\.\s*(?:<|[A-Z])|</p>)",
        rationale,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        # Broader fallback
        m = re.search(
            r"correct answer is\s+(.*?)(?:</p>|$)",
            rationale,
            re.IGNORECASE | re.DOTALL,
        )
    if not m:
        return None

    chunk = m.group(1)

    # --- Step 2: Extract answers from alt text of images in the chunk ---
    alt_answers = []
    for alt in re.findall(r'alt="([^"]+)"', chunk):
        frac = _parse_alt_fraction(alt)
        if frac:
            alt_answers.append(frac)

    # --- Step 3: Extract plain-text answers ---
    # Strip HTML from the chunk
    plain = re.sub(r"<[^>]+>", " ", chunk)
    plain = re.sub(r"\s+", " ", plain).strip()
    plain = plain.replace(",", "")
    # Remove leading "either"
    plain = re.sub(r"^either\s+", "", plain, flags=re.IGNORECASE)
    # Remove trailing period
    plain = plain.rstrip(".")

    text_answers = []
    if plain:
        # Split on "or" and ","
        parts = re.split(r"\s*,\s*|\s+or\s+", plain, flags=re.IGNORECASE)
        for part in parts:
            part = part.strip().rstrip(".")
            if not part:
                continue
            # Only keep if it looks like a number or fraction
            if re.match(r"^-?[\d./]+$", part):
                text_answers.append(part)

    # Combine — prefer text answers, fall back to alt answers
    raw_answers = text_answers if text_answers else alt_answers
    if not raw_answers:
        return None

    # --- Step 4: Add equivalent forms (decimal ↔ fraction) ---
    answers = []
    for ans in raw_answers:
        answers.append(ans)
        if "/" in ans:
            try:
                decimal = float(Fraction(ans))
                dec_str = f"{decimal:g}"
                if dec_str not in answers:
                    answers.append(dec_str)
            except (ValueError, ZeroDivisionError):
                pass
        elif "." in ans:
            try:
                frac = Fraction(ans).limit_denominator(1000)
                if frac.denominator <= 100:
                    frac_str = f"{frac.numerator}/{frac.denominator}"
                    if frac_str not in answers:
                        answers.append(frac_str)
            except (ValueError, OverflowError):
                pass

    return answers if answers else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes to DB")
    args = parser.parse_args()

    db = SessionLocal()
    session = requests.Session()
    session.headers.update(HEADERS)

    wildcards = db.query(Question).filter(
        Question.answer_type == AnswerType.SPR,
        Question.correct_answer_json.contains({"answers": ["*"]}),
    ).all()

    print(f"Found {len(wildcards)} wildcard SPR questions\n")

    fixed = 0
    failed = []

    for i, q in enumerate(wildcards):
        ibn = q.ibn
        if not ibn:
            failed.append((str(q.id), "no IBN"))
            continue

        try:
            resp = session.get(f"{DISC_BASE}/{ibn}.json", timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                data = data[0]
        except Exception as e:
            failed.append((str(q.id), f"fetch error: {e}"))
            continue

        rationale = data.get("answer", {}).get("rationale", "")
        answers = extract_answer_from_rationale(rationale)

        if answers:
            print(f"  [{i+1:2d}/70] {ibn}: {answers}")
            if args.apply:
                q.correct_answer_json = {"answers": answers}
                q.is_active = True
                # Also store the rationale as explanation if missing
                if not q.explanation_html and rationale:
                    q.explanation_html = rationale
            fixed += 1
        else:
            print(f"  [{i+1:2d}/70] {ibn}: FAILED to extract answer")
            failed.append((str(q.id), f"ibn={ibn}, no answer in rationale"))

        time.sleep(0.15)

    if args.apply:
        db.commit()
        print(f"\nApplied: {fixed} questions updated and reactivated")
    else:
        print(f"\nDry run: {fixed} would be fixed")

    if failed:
        print(f"\nFailed ({len(failed)}):")
        for qid, reason in failed:
            print(f"  {qid}: {reason}")

    db.close()


if __name__ == "__main__":
    main()
