#!/usr/bin/env python3
"""
Match practice test questions to database questions using fuzzy text matching.

Works for any test number and either variant (easier or harder Module 2).
The hard variant assumes the easy variant has already been mapped — Module 1
questions are reused from there since they're identical between variants, and
only Module 2 questions are matched.

Usage:
    python3 match_practice_test_v2.py <test_number> <variant>
    python3 match_practice_test_v2.py 5 easy
    python3 match_practice_test_v2.py 5 hard
"""

import json
import re
import sys
from pathlib import Path
from difflib import SequenceMatcher
from typing import Dict, Any, Tuple


def strip_html(html_text: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', html_text)
    text = re.sub(r'\s+', ' ', text)
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&amp;', '&')
    text = text.replace('&rsquo;', "'")
    text = text.replace('&ldquo;', '"')
    text = text.replace('&rdquo;', '"')
    text = text.replace('&mdash;', '-')
    text = text.replace('&ndash;', '-')
    # Strip "Reading and Writing: Question N" / "Math: Question N" headers
    text = re.sub(r'^(reading and writing|math):\s*question\s+\d+', '', text, flags=re.IGNORECASE)
    return text.strip().lower()


def similarity_score(text1: str, text2: str) -> float:
    return SequenceMatcher(None, text1, text2).ratio()


def load_database() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    data_dir = Path(__file__).parent.parent / "data"
    with open(data_dir / "math_core.json") as f:
        math_db = json.load(f)
    with open(data_dir / "reading_core.json") as f:
        reading_db = json.load(f)
    return math_db, reading_db


def find_best_match(extracted_text: str, database: Dict[str, Any], threshold: float = 0.60):
    best_match = None
    best_score = 0.0
    extracted_clean = strip_html(extracted_text)

    for uid, question in database.items():
        parts = []
        content = question.get('content', {})
        if not isinstance(content, dict):
            continue  # malformed entry
        if 'stimulus' in content:
            parts.append(strip_html(content['stimulus']))
        if 'stem' in content:
            parts.append(strip_html(content['stem']))
        options = content.get('answerOptions', []) or []
        if isinstance(options, list):
            for option in options:
                if isinstance(option, dict) and 'value' in option:
                    parts.append(strip_html(option['value']))
        db_text = ' '.join(parts)

        score = similarity_score(extracted_clean, db_text)
        if score > best_score:
            best_score = score
            best_match = uid

    if best_score >= threshold:
        return best_match, best_score
    return None, 0.0


def determine_module(question_num: int) -> Tuple[str, int]:
    if question_num <= 27:
        return 'rw', 1
    elif question_num <= 54:
        return 'rw', 2
    elif question_num <= 76:
        return 'math', 1
    return 'math', 2


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 match_practice_test_v2.py <test_number> <variant>")
        print("       variant must be 'easy' or 'hard'")
        sys.exit(1)

    test_number = int(sys.argv[1])
    variant = sys.argv[2].lower()
    if variant not in ('easy', 'hard'):
        print("variant must be 'easy' or 'hard'")
        sys.exit(1)

    variant_long = 'easier' if variant == 'easy' else 'harder'

    data_dir = Path(__file__).parent.parent / "data"
    extracted_path = data_dir / f"practice_test_{test_number}_questions_{variant}.json"
    if not extracted_path.exists():
        print(f"Could not find extracted file: {extracted_path}")
        sys.exit(1)

    print(f"Loading extracted questions from {extracted_path.name}...")
    with open(extracted_path) as f:
        extracted_questions = json.load(f)
    print(f"Found {len(extracted_questions)} extracted questions")

    print("\nLoading question bank...")
    math_db, reading_db = load_database()
    print(f"Database: {len(math_db)} math questions, {len(reading_db)} reading questions")

    output_dir = data_dir / "practice_test_mappings"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"practice_test_{test_number}_modules_1_2_{variant}.json"

    # For HARD variant: load the EASY variant first to reuse Module 1 mappings
    reused_module_1_rw = []
    reused_module_1_math = []
    if variant == 'hard':
        easy_path = output_dir / f"practice_test_{test_number}_modules_1_2_easy.json"
        if easy_path.exists():
            with open(easy_path) as f:
                easy_mapping = json.load(f)
            reused_module_1_rw = easy_mapping.get('rw_module_1', [])
            reused_module_1_math = easy_mapping.get('math_module_1', [])
            print(f"\nReusing Module 1 mappings from easy variant: "
                  f"{len(reused_module_1_rw)} R/W + {len(reused_module_1_math)} math")

    mapping = {
        "test_number": test_number,
        "test_name": f"SAT Practice {test_number}",
        "variant": variant,
        "rw_module_1": reused_module_1_rw,
        f"rw_module_2_{variant_long}": [],
        "math_module_1": reused_module_1_math,
        f"math_module_2_{variant_long}": [],
        "matches": [],
    }

    print("\nMatching questions...\n")
    for extracted in extracted_questions:
        q_num = extracted['questionNumber']
        section, module_num = determine_module(q_num)

        # Skip Module 1 if we're doing hard variant — already mapped from easy
        if variant == 'hard' and module_num == 1:
            continue

        db = reading_db if section == 'rw' else math_db
        extracted_text = extracted.get('text', '') or extracted.get('html', '')
        uid, score = find_best_match(extracted_text, db)

        if module_num == 1:
            key = f"{section}_module_1"
        else:
            key = f"{section}_module_2_{variant_long}"

        if uid:
            mapping[key].append(uid)
            mapping['matches'].append({
                "questionNumber": q_num,
                "section": section,
                "module": module_num,
                "uId": uid,
                "similarity": round(score, 4),
                "preview": extracted_text[:100] if extracted_text else "",
            })
            print(f"  Q{q_num:2d} ({section.upper():4s} M{module_num}) -> {uid} ({score:.2%})")
        else:
            print(f"  Q{q_num:2d} ({section.upper():4s} M{module_num}) -> NO MATCH")
            mapping['matches'].append({
                "questionNumber": q_num,
                "section": section,
                "module": module_num,
                "uId": None,
                "similarity": 0.0,
                "preview": extracted_text[:100] if extracted_text else "",
                "error": "No match above threshold",
            })

    with open(output_path, 'w') as f:
        json.dump(mapping, f, indent=2)
    print(f"\nSaved mapping to: {output_path}")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total extracted: {len(extracted_questions)}")
    print(f"Matched (auto): {sum(1 for m in mapping['matches'] if m['uId'])}")
    print(f"Unmatched: {sum(1 for m in mapping['matches'] if not m['uId'])}")
    print()
    print(f"RW Module 1: {len(mapping['rw_module_1'])}")
    print(f"RW Module 2 ({variant_long}): {len(mapping[f'rw_module_2_{variant_long}'])}")
    print(f"Math Module 1: {len(mapping['math_module_1'])}")
    print(f"Math Module 2 ({variant_long}): {len(mapping[f'math_module_2_{variant_long}'])}")

    unmatched = [m for m in mapping['matches'] if not m['uId']]
    if unmatched:
        print("\n" + "=" * 60)
        print("UNMATCHED (manual review needed)")
        print("=" * 60)
        for m in unmatched:
            print(f"\nQ{m['questionNumber']} ({m['section'].upper()} M{m['module']}):")
            print(f"  {m['preview'][:200]}")


if __name__ == "__main__":
    main()
