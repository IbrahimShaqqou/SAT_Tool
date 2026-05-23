#!/usr/bin/env python3
"""
Match Practice Test 4 questions to database questions using fuzzy text matching.

Usage:
    python3 match_practice_test.py
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


def find_best_match(extracted_text: str, database: Dict[str, Any], threshold: float = 0.60) -> Tuple[str, float]:
    """
    Find best matching question in database.

    Returns:
        Tuple of (uId, similarity_score) or (None, 0.0) if no match above threshold
    """
    best_match = None
    best_score = 0.0

    extracted_clean = strip_html(extracted_text)

    for uid, question in database.items():
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
    extracted_path = Path(__file__).parent.parent / "data" / "e23af39b-617a-4f19-979c-305a9920b4e7"

    print("Loading extracted questions...")
    with open(extracted_path) as f:
        extracted_questions = json.load(f)

    print(f"Found {len(extracted_questions)} extracted questions")

    # Load database
    print("\nLoading database...")
    math_db, reading_db = load_database()
    print(f"Database: {len(math_db)} math questions, {len(reading_db)} reading questions")

    # Create mapping structure
    mapping = {
        "test_number": 4,
        "test_name": "SAT Practice 4",
        "date_extracted": "2026-05-22",
        "note": "Module 2 is the EASIER version (student answered all Module 1 questions wrong)",
        "rw_module_1": [],
        "rw_module_2_easier": [],
        "math_module_1": [],
        "math_module_2_easier": [],
        "matches": []
    }

    # Match each question
    print("\nMatching questions...\n")

    for extracted in extracted_questions:
        q_num = extracted['questionNumber']
        section, module_num = determine_module(q_num)

        # Determine which database to search
        db = reading_db if section == 'rw' else math_db

        # Find best match
        extracted_text = extracted.get('text', '') or extracted.get('html', '')
        uid, score = find_best_match(extracted_text, db)

        # Categorize
        if module_num == 1:
            key = f"{section}_module_1"
        else:
            key = f"{section}_module_2_easier"

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
    output_dir.mkdir(exist_ok=True)

    output_path = output_dir / "practice_test_4_modules_1_2_easy.json"

    with open(output_path, 'w') as f:
        json.dump(mapping, f, indent=2)

    print(f"\n✓ Saved mapping to: {output_path}")

    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total questions: {len(extracted_questions)}")
    print(f"Matched: {sum(1 for m in mapping['matches'] if m['uId'])}")
    print(f"Unmatched: {sum(1 for m in mapping['matches'] if not m['uId'])}")
    print()
    print(f"RW Module 1: {len(mapping['rw_module_1'])} questions")
    print(f"RW Module 2 (easier): {len(mapping['rw_module_2_easier'])} questions")
    print(f"Math Module 1: {len(mapping['math_module_1'])} questions")
    print(f"Math Module 2 (easier): {len(mapping['math_module_2_easier'])} questions")

    # Show unmatched questions
    unmatched = [m for m in mapping['matches'] if not m['uId']]
    if unmatched:
        print("\n" + "="*60)
        print("UNMATCHED QUESTIONS (need manual review)")
        print("="*60)
        for match in unmatched:
            print(f"\nQ{match['questionNumber']} ({match['section'].upper()} M{match['module']}):")
            print(f"  {match['preview'][:150]}...")


if __name__ == "__main__":
    main()
