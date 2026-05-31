#!/usr/bin/env python3
"""
Manual matching tool for unmatched PT6 questions.

For each unmatched question, searches the database using multiple strategies
and allows interactive confirmation of matches.
"""

import json
import re
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.question import Question


def strip_html(text: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_key_phrases(text: str) -> List[str]:
    """Extract key phrases from question text for searching."""
    # Remove the header line "Reading and Writing: Question X"
    text = re.sub(r'^(Reading and Writing|Math):\s*Question\s*\d+\s*\n', '', text, flags=re.IGNORECASE)

    # Remove common question stems
    text = re.sub(r'(Which choice|Which of the following|What is|Based on).*?\?', '', text, flags=re.IGNORECASE)

    # Split into sentences
    sentences = re.split(r'[.!?]\s+', text)

    # Get meaningful phrases (proper nouns, quoted text, numbers with context)
    phrases = []

    # Look for quoted text
    quoted = re.findall(r'"([^"]{10,})"', text)
    phrases.extend(quoted[:2])

    # Look for proper nouns (capitalized words with 2+ consecutive caps)
    proper_nouns = re.findall(r'\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
    # Filter out common words
    stop_words = ['The', 'A', 'An', 'In', 'On', 'For', 'To', 'Which', 'What', 'Based',
                  'Reading', 'Writing', 'Question', 'Text', 'Math']
    proper_nouns = [n for n in proper_nouns if not any(sw in n.split() for sw in stop_words)]
    phrases.extend(proper_nouns[:3])

    # Look for years
    years = re.findall(r'\b(1[0-9]{3}|20[0-9]{2})\b', text)
    phrases.extend(years)

    # Get first substantive sentence (at least 40 chars)
    for sentence in sentences:
        clean = sentence.strip()
        if len(clean) > 40 and not clean.startswith('Question'):
            phrases.append(clean[:80])
            break

    return [p for p in phrases if len(p) > 5]


def search_database(db: Session, question_text: str, subject_area: str) -> List[Question]:
    """Search database using multiple strategies."""
    candidates = []
    seen_ids = set()

    key_phrases = extract_key_phrases(question_text)

    print(f"  Searching with key phrases: {key_phrases[:3]}")

    # Try each phrase
    for phrase in key_phrases[:5]:
        if len(phrase) < 5:
            continue

        pattern = f"%{phrase}%"
        results = db.query(Question).filter(
            Question.subject_area == subject_area,
            Question.prompt_html.ilike(pattern)
        ).limit(5).all()

        for q in results:
            if q.id not in seen_ids:
                candidates.append(q)
                seen_ids.add(q.id)

        if len(candidates) >= 5:
            break

    return candidates[:5]


def show_question_comparison(extracted_q: dict, db_q: Question):
    """Display extracted question vs database question side by side."""
    extracted_text = strip_html(extracted_q['text'])
    db_text = strip_html(db_q.prompt_html)

    print("\n" + "=" * 80)
    print("EXTRACTED QUESTION:")
    print("-" * 80)
    print(extracted_text[:500])
    print("\n" + "=" * 80)
    print("DATABASE CANDIDATE:")
    print("-" * 80)
    print(db_text[:500])
    print("\n" + "=" * 80)
    print(f"External ID: {db_q.external_id}")
    print(f"Skill ID: {db_q.skill_id}")
    print(f"Difficulty: {db_q.difficulty}")
    print(f"Score Band: {db_q.score_band_range}")
    print("=" * 80)


def load_unmatched_questions(data_dir: Path, variant: str) -> List[dict]:
    """Load unmatched questions from mapping file."""
    mapping_path = data_dir / f"practice_test_6_modules_1_2_{variant}.json"
    with open(mapping_path) as f:
        mapping = json.load(f)

    # Load extraction
    extraction_path = data_dir.parent / f"practice_test_6_questions_{variant}.json"
    with open(extraction_path) as f:
        extracted = json.load(f)

    # Find unmatched (uId is null in mapping)
    unmatched = []

    for module_key, question_list in mapping.items():
        # Skip metadata fields
        if not isinstance(question_list, list):
            continue

        for item in question_list:
            if isinstance(item, dict) and item.get('uId') is None:
                q_num = item['questionNumber']

                # Determine module key for updating later
                section = item['section']
                module = item['module']

                if section == 'rw' and module == 1:
                    mod_key = 'rw_module_1'
                elif section == 'rw' and module == 2:
                    mod_key = 'rw_module_2_easier' if 'easier' in module_key else 'rw_module_2_harder'
                elif section == 'math' and module == 1:
                    mod_key = 'math_module_1'
                else:
                    mod_key = 'math_module_2_easier' if 'easier' in module_key else 'math_module_2_harder'

                # Find in extraction
                for eq in extracted:
                    if eq['questionNumber'] == q_num:
                        unmatched.append({
                            'question_number': q_num,
                            'module_key': module_key,
                            'mapping_item': item,  # Reference to update later
                            'extracted': eq
                        })
                        break

    return unmatched


def save_updated_mapping(data_dir: Path, variant: str, mapping: dict):
    """Save updated mapping file (detailed) and create simple mapping for seeding."""
    # Save detailed mapping
    mapping_path = data_dir / f"practice_test_6_modules_1_2_{variant}.json"
    with open(mapping_path, 'w') as f:
        json.dump(mapping, f, indent=2)
    print(f"\n✓ Saved updated mapping to {mapping_path.name}")

    # Create simple mapping for seed script (just uIds)
    simple_mapping = {
        'test_number': mapping.get('test_number', 6),
        'test_name': mapping.get('test_name', 'SAT Practice 6'),
        'variant': variant,
    }

    for module_key, question_list in mapping.items():
        if isinstance(question_list, list):
            # Extract uIds only, filter out nulls
            uids = [item['uId'] if isinstance(item, dict) else item
                   for item in question_list]
            uids = [uid for uid in uids if uid is not None]
            simple_mapping[module_key] = uids

    # Save simple mapping
    simple_path = data_dir / f"practice_test_6_modules_1_2_{variant}_simple.json"
    with open(simple_path, 'w') as f:
        json.dump(simple_mapping, f, indent=2)
    print(f"✓ Saved simple mapping to {simple_path.name}")


def main():
    data_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"

    print("=" * 80)
    print("PT6 Manual Matching Tool")
    print("=" * 80)

    variant = input("\nWhich variant to process? (easy/hard): ").strip().lower()
    if variant not in ['easy', 'hard']:
        print("Invalid variant")
        return

    db = SessionLocal()

    try:
        # Load current mapping
        mapping_path = data_dir / f"practice_test_6_modules_1_2_{variant}.json"
        with open(mapping_path) as f:
            mapping = json.load(f)

        unmatched = load_unmatched_questions(data_dir, variant)

        print(f"\nFound {len(unmatched)} unmatched questions")
        print("\nStarting interactive matching...\n")

        matches_made = 0

        for item in unmatched:
            q_num = item['question_number']
            module_key = item['module_key']
            mapping_item = item['mapping_item']
            extracted = item['extracted']

            print("\n" + "=" * 80)
            print(f"Question {q_num} ({module_key})")
            print("=" * 80)

            # Determine subject area from mapping item
            section = mapping_item.get('section', '')
            subject_area = 'reading_writing' if section == 'rw' else 'math'

            # Search database
            candidates = search_database(db, extracted['text'], subject_area)

            if not candidates:
                print("  No candidates found in database")
                print(f"\n  Full question text:\n  {strip_html(extracted['text'])[:300]}...")
                cont = input("\n  Press Enter to continue to next question...")
                continue

            print(f"\n  Found {len(candidates)} candidate(s)")

            # Show each candidate
            for i, candidate in enumerate(candidates, 1):
                print(f"\n--- Candidate {i}/{len(candidates)} ---")
                show_question_comparison(extracted, candidate)

                choice = input("\n  Is this a match? (y/n/s=skip all): ").strip().lower()

                if choice == 'y':
                    # Update mapping item directly
                    mapping_item['uId'] = candidate.external_id
                    mapping_item['similarity'] = 1.0  # Manual match
                    mapping_item['error'] = None
                    matches_made += 1
                    print(f"  ✓ Matched Q{q_num} -> {candidate.external_id}")
                    break
                elif choice == 's':
                    break

            if (q_num - unmatched[0]['question_number']) % 3 == 2:
                save_choice = input("\n  Save progress? (y/n): ").strip().lower()
                if save_choice == 'y':
                    save_updated_mapping(data_dir, variant, mapping)

        # Final save
        save_updated_mapping(data_dir, variant, mapping)

        print(f"\n{'=' * 80}")
        print(f"Matching complete: {matches_made} new matches")
        print(f"{'=' * 80}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
