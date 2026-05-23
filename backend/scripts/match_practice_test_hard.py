#!/usr/bin/env python3
"""
Match Practice Test 4 HARD variant questions to database.

This extracts Module 2 HARD questions (student scored well on Module 1).
Module 1 questions should be identical to the easy variant.
"""

import json
import re
from pathlib import Path
from difflib import SequenceMatcher
from typing import Dict, List, Any, Tuple


def strip_html(html_text: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Decode common HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&amp;', '&')
    text = text.replace('&rsquo;', "'")
    text = text.replace('&ldquo;', '"')
    text = text.replace('&rdquo;', '"')
    # Remove question headers like "Reading and Writing: Question 1" or "Math: Question 5"
    text = re.sub(r'^(reading and writing|math):\s*question\s+\d+', '', text, flags=re.IGNORECASE)
    return text.strip().lower()


def similarity_score(text1: str, text2: str) -> float:
    """Calculate similarity score between two texts (0.0 to 1.0)."""
    return SequenceMatcher(None, text1, text2).ratio()


def load_database() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Load math and reading database questions."""
    data_dir = Path(__file__).parent.parent / "data"

    with open(data_dir / "math_core.json") as f:
        math_db = json.load(f)

    with open(data_dir / "reading_core.json") as f:
        reading_db = json.load(f)

    return math_db, reading_db


def load_easy_mapping() -> Dict[str, Any]:
    """Load the easy variant mapping to reuse Module 1 questions."""
    mapping_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"
    with open(mapping_dir / "practice_test_4_modules_1_2_easy.json") as f:
        return json.load(f)


def find_best_match(extracted_text: str, database: Dict[str, Any], exclude_uids: set, threshold: float = 0.60) -> Tuple[str, float]:
    """
    Find best matching question in database.

    Args:
        extracted_text: Text from extracted question
        database: Question database
        exclude_uids: Set of uIds to exclude (already used in Module 1)
        threshold: Minimum similarity score

    Returns:
        Tuple of (uId, similarity_score) or (None, 0.0) if no match above threshold
    """
    best_match = None
    best_score = 0.0

    extracted_clean = strip_html(extracted_text)

    for uid, question in database.items():
        # Skip if this question was used in Module 1 (should only match Module 2 questions)
        if uid in exclude_uids:
            continue

        # Extract text from question content
        db_text_parts = []

        content = question.get('content', {})

        # Add stimulus (the question text)
        if 'stimulus' in content:
            db_text_parts.append(strip_html(content['stimulus']))

        # Add stem (the actual prompt)
        if 'stem' in content:
            db_text_parts.append(strip_html(content['stem']))

        # Add answer options
        if 'answerOptions' in content:
            for option in content.get('answerOptions', []):
                if 'value' in option:
                    db_text_parts.append(strip_html(option['value']))

        db_text = ' '.join(db_text_parts)

        # Calculate similarity
        score = similarity_score(extracted_clean, db_text)

        if score > best_score:
            best_score = score
            best_match = uid

    if best_score >= threshold:
        return best_match, best_score
    return None, 0.0


def determine_module(question_num: int) -> Tuple[str, int]:
    """
    Determine section and module based on question number.

    SAT structure:
    - Questions 1-27: Reading/Writing Module 1
    - Questions 28-54: Reading/Writing Module 2
    - Questions 55-76: Math Module 1
    - Questions 77-98: Math Module 2

    Returns:
        Tuple of (section, module_num) where section is 'rw' or 'math'
    """
    if question_num <= 27:
        return 'rw', 1
    elif question_num <= 54:
        return 'rw', 2
    elif question_num <= 76:
        return 'math', 1
    else:
        return 'math', 2


def main():
    # Load extracted questions
    extracted_path = Path(__file__).parent.parent / "data" / "f8290023-adc5-4bac-8a9d-f0ffb3bafedb"

    print("Loading extracted HARD variant questions...")
    with open(extracted_path) as f:
        extracted_questions = json.load(f)

    print(f"Found {len(extracted_questions)} extracted questions")

    # Load easy mapping to get Module 1 questions
    print("\nLoading easy variant mapping...")
    easy_mapping = load_easy_mapping()

    # Get all Module 1 uIds from easy variant (these should be the same)
    module1_uids = set(easy_mapping['rw_module_1'] + easy_mapping['math_module_1'])
    print(f"Reusing {len(module1_uids)} Module 1 questions from easy variant")

    # Load database
    print("\nLoading database...")
    math_db, reading_db = load_database()
    print(f"Database: {len(math_db)} math questions, {len(reading_db)} reading questions")

    # Create mapping structure
    mapping = {
        "test_number": 4,
        "test_name": "SAT Practice 4",
        "date_extracted": "2026-05-22",
        "note": "Module 2 is the HARDER version (student scored well on Module 1). Module 1 questions copied from easy variant.",
        "rw_module_1": easy_mapping['rw_module_1'],
        "rw_module_2_harder": [],
        "math_module_1": easy_mapping['math_module_1'],
        "math_module_2_harder": [],
        "matches": []
    }

    # Add Module 1 matches from easy variant
    for match in easy_mapping['matches']:
        if match['module'] == 1:
            mapping['matches'].append({
                **match,
                "note": "Copied from easy variant (Module 1 is same in both)"
            })

    # Match Module 2 questions only
    print("\nMatching Module 2 questions...\n")

    for extracted in extracted_questions:
        q_num = extracted['questionNumber']
        section, module_num = determine_module(q_num)

        # Skip Module 1 (already mapped from easy variant)
        if module_num == 1:
            continue

        # Determine which database to search
        db = reading_db if section == 'rw' else math_db

        # Find best match (excluding Module 1 questions)
        extracted_text = extracted.get('text', '') or extracted.get('html', '')
        uid, score = find_best_match(extracted_text, db, module1_uids)

        # Categorize
        key = f"{section}_module_2_harder"

        if uid:
            mapping[key].append(uid)
            match_info = {
                "questionNumber": q_num,
                "section": section,
                "module": module_num,
                "uId": uid,
                "similarity": round(score, 4),
                "preview": extracted_text[:100] if extracted_text else ""
            }
            mapping['matches'].append(match_info)
            print(f"✓ Q{q_num:2d} ({section.upper():4s} M{module_num}) → {uid} ({score:.2%})")
        else:
            print(f"✗ Q{q_num:2d} ({section.upper():4s} M{module_num}) → NO MATCH FOUND")
            mapping['matches'].append({
                "questionNumber": q_num,
                "section": section,
                "module": module_num,
                "uId": None,
                "similarity": 0.0,
                "preview": extracted_text[:100] if extracted_text else "",
                "error": "No match above threshold"
            })

    # Save mapping
    output_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"
    output_path = output_dir / "practice_test_4_modules_1_2_hard.json"

    with open(output_path, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\n✓ Saved mapping to: {output_path}")

    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total questions: {len(extracted_questions)}")
    print(f"Module 1 (reused): {len(module1_uids)}")
    print(f"Module 2 matched: {sum(1 for m in mapping['matches'] if m['module'] == 2 and m['uId'])}")
    print(f"Module 2 unmatched: {sum(1 for m in mapping['matches'] if m['module'] == 2 and not m['uId'])}")
    print()
    print(f"RW Module 1: {len(mapping['rw_module_1'])} questions (from easy variant)")
    print(f"RW Module 2 (harder): {len(mapping['rw_module_2_harder'])} questions")
    print(f"Math Module 1: {len(mapping['math_module_1'])} questions (from easy variant)")
    print(f"Math Module 2 (harder): {len(mapping['math_module_2_harder'])} questions")

    # Show unmatched questions
    unmatched = [m for m in mapping['matches'] if m['module'] == 2 and not m['uId']]
    if unmatched:
        print("\n" + "="*60)
        print("UNMATCHED QUESTIONS (need manual review)")
        print("="*60)
        for match in unmatched:
            print(f"\nQ{match['questionNumber']} ({match['section'].upper()} M{match['module']}):")
            print(f"  {match['preview'][:150]}...")


if __name__ == "__main__":
    main()
