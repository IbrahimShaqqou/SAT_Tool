#!/usr/bin/env python3
"""
Bluebook Question Matcher
Helper tool to map Bluebook practice test questions to database.

Usage:
1. Start Bluebook and begin a practice test
2. Run this script: python question_matcher.py
3. Copy-paste each question prompt when prompted
4. Confirm the matched question
5. Script builds mapping JSON automatically

Output: /backend/data/practice_test_mappings/test_N.json
"""

import os
import sys
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Database connection
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create DB session
engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)


def strip_html(html_text):
    """Remove HTML tags and clean text for matching."""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html_text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep math symbols
    text = text.strip()
    return text


def similarity_score(a, b):
    """Calculate similarity between two strings (0-1)."""
    return SequenceMatcher(None, a, b).ratio()


def find_matching_questions(prompt_text, db_session, subject_area='MATH', top_n=5):
    """
    Find questions in database matching the given prompt.

    Args:
        prompt_text: The question text to search for
        db_session: Database session
        subject_area: 'MATH' or 'READING_WRITING'
        top_n: Number of top matches to return

    Returns:
        List of (question, similarity_score) tuples
    """
    # Get all questions for this subject
    query = text("""
        SELECT id, uid, prompt_html, difficulty, skill_cd, skill_desc
        FROM questions
        WHERE subject_area = :subject_area
        AND is_active = true
    """)

    results = db_session.execute(query, {"subject_area": subject_area}).fetchall()

    # Clean input prompt
    clean_prompt = strip_html(prompt_text).lower()

    # Calculate similarity for each question
    matches = []
    for row in results:
        question_id, uid, prompt_html, difficulty, skill_cd, skill_desc = row
        clean_db_prompt = strip_html(prompt_html).lower()

        score = similarity_score(clean_prompt, clean_db_prompt)

        # Only include good matches (>30% similarity)
        if score > 0.3:
            matches.append({
                'id': str(question_id),
                'uid': str(uid),
                'prompt': prompt_html,
                'difficulty': difficulty,
                'skill_cd': skill_cd,
                'skill_desc': skill_desc,
                'similarity': score
            })

    # Sort by similarity (highest first)
    matches.sort(key=lambda x: x['similarity'], reverse=True)

    return matches[:top_n]


def display_match(match, index):
    """Display a single match option."""
    print(f"\n[{index}] Similarity: {match['similarity']:.1%} | "
          f"Difficulty: {match['difficulty']} | Skill: {match['skill_cd']}")
    prompt_preview = strip_html(match['prompt'])[:200]
    print(f"    {prompt_preview}...")


def collect_module_questions(db_session, test_number, module_name, subject_area, expected_count):
    """
    Interactive collection of questions for a module.

    Args:
        db_session: Database session
        test_number: Practice test number (1-6)
        module_name: e.g., "math_module_1", "math_module_2_easier"
        subject_area: 'MATH' or 'READING_WRITING'
        expected_count: Expected number of questions (22 for math, 27 for R/W)

    Returns:
        List of question UIDs
    """
    print(f"\n{'='*60}")
    print(f"Practice Test {test_number} - {module_name}")
    print(f"Expected: {expected_count} questions")
    print(f"{'='*60}\n")

    question_uids = []
    question_num = 1

    while len(question_uids) < expected_count:
        print(f"\n--- Question {question_num}/{expected_count} ---")
        print("Paste the question prompt (or 'skip' to skip, 'done' if finished, 'back' to undo last):")

        prompt_text = input("> ").strip()

        if prompt_text.lower() == 'done':
            if len(question_uids) < expected_count:
                confirm = input(f"Only {len(question_uids)}/{expected_count} questions collected. Finish anyway? (y/n): ")
                if confirm.lower() == 'y':
                    break
                else:
                    continue
            break

        if prompt_text.lower() == 'skip':
            print("Skipping this question (will need to fill in later)")
            question_uids.append(None)
            question_num += 1
            continue

        if prompt_text.lower() == 'back':
            if question_uids:
                removed = question_uids.pop()
                question_num = max(1, question_num - 1)
                print(f"Removed last entry: {removed}")
            else:
                print("No questions to remove")
            continue

        if not prompt_text:
            print("No input. Try again.")
            continue

        # Search for matches
        print("Searching database...")
        matches = find_matching_questions(prompt_text, db_session, subject_area, top_n=5)

        if not matches:
            print("❌ No matches found. Try rewording or check subject area.")
            retry = input("Retry? (y/n): ")
            if retry.lower() != 'y':
                question_num += 1
            continue

        # Display matches
        print(f"\nFound {len(matches)} potential matches:")
        for i, match in enumerate(matches, 1):
            display_match(match, i)

        # Get user selection
        while True:
            selection = input(f"\nSelect match (1-{len(matches)}), 'r' to retry, 's' to skip: ").strip()

            if selection.lower() == 'r':
                break  # Restart this question

            if selection.lower() == 's':
                question_uids.append(None)
                question_num += 1
                break

            try:
                idx = int(selection) - 1
                if 0 <= idx < len(matches):
                    selected_uid = matches[idx]['uid']
                    question_uids.append(selected_uid)
                    print(f"✓ Added: {selected_uid}")
                    question_num += 1
                    break
                else:
                    print("Invalid selection")
            except ValueError:
                print("Invalid input")

    return question_uids


def save_mapping(test_number, mappings, output_dir):
    """Save test mapping to JSON file."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / f"practice_test_{test_number}.json"

    mapping_data = {
        "test_number": test_number,
        "test_name": f"Bluebook Practice Test {test_number}",
        "date_mapped": "2026-05-22",
        "mappings": mappings
    }

    with open(output_file, 'w') as f:
        json.dump(mapping_data, f, indent=2)

    print(f"\n✓ Mapping saved to: {output_file}")


def main():
    """Main interactive mapping process."""
    print("""
╔═══════════════════════════════════════════════════════════╗
║        Bluebook Practice Test Question Mapper             ║
╚═══════════════════════════════════════════════════════════╝

This tool helps you map Bluebook practice test questions
to your database by matching question text.

Instructions:
1. Open Bluebook and start a practice test
2. For each question, copy the prompt text
3. Paste it here when prompted
4. Confirm the matched question
5. Repeat for all questions in the module

The tool will save a mapping file automatically.
""")

    # Get test details
    test_number = input("Enter practice test number (1-6): ").strip()
    try:
        test_number = int(test_number)
        if not 1 <= test_number <= 6:
            raise ValueError
    except ValueError:
        print("Invalid test number. Exiting.")
        return

    # Database session
    db = Session()

    try:
        mappings = {}

        # Math Module 1
        print("\n\n=== MATH MODULE 1 ===")
        input("Press Enter when ready to start Math Module 1...")
        mappings['math_module_1'] = collect_module_questions(
            db, test_number, "Math Module 1", "MATH", 22
        )

        # Math Module 2 - Easier
        print("\n\n=== MATH MODULE 2 - EASIER BRANCH ===")
        print("(You'll need to score poorly on Module 1 to see this)")
        do_easier = input("Map easier branch now? (y/n): ").lower() == 'y'
        if do_easier:
            mappings['math_module_2_easier'] = collect_module_questions(
                db, test_number, "Math Module 2 (Easier)", "MATH", 22
            )

        # Math Module 2 - Harder
        print("\n\n=== MATH MODULE 2 - HARDER BRANCH ===")
        print("(You'll need to score well on Module 1 to see this)")
        do_harder = input("Map harder branch now? (y/n): ").lower() == 'y'
        if do_harder:
            mappings['math_module_2_harder'] = collect_module_questions(
                db, test_number, "Math Module 2 (Harder)", "MATH", 22
            )

        # Reading/Writing Module 1
        print("\n\n=== READING/WRITING MODULE 1 ===")
        do_rw = input("Continue to R/W modules? (y/n): ").lower() == 'y'
        if do_rw:
            mappings['rw_module_1'] = collect_module_questions(
                db, test_number, "R/W Module 1", "READING_WRITING", 27
            )

            # R/W Module 2 - Easier
            print("\n\n=== READING/WRITING MODULE 2 - EASIER BRANCH ===")
            do_easier = input("Map easier branch now? (y/n): ").lower() == 'y'
            if do_easier:
                mappings['rw_module_2_easier'] = collect_module_questions(
                    db, test_number, "R/W Module 2 (Easier)", "READING_WRITING", 27
                )

            # R/W Module 2 - Harder
            print("\n\n=== READING/WRITING MODULE 2 - HARDER BRANCH ===")
            do_harder = input("Map harder branch now? (y/n): ").lower() == 'y'
            if do_harder:
                mappings['rw_module_2_harder'] = collect_module_questions(
                    db, test_number, "R/W Module 2 (Harder)", "READING_WRITING", 27
                )

        # Save results
        output_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"
        save_mapping(test_number, mappings, output_dir)

        # Summary
        print(f"\n{'='*60}")
        print("MAPPING SUMMARY")
        print(f"{'='*60}")
        for module_name, uids in mappings.items():
            mapped_count = sum(1 for uid in uids if uid is not None)
            total_count = len(uids)
            print(f"{module_name}: {mapped_count}/{total_count} questions mapped")

        print(f"\nNext steps:")
        print(f"1. Review the mapping file")
        print(f"2. Fill in any skipped questions (None values)")
        print(f"3. Repeat for remaining modules/branches")
        print(f"4. Repeat for other practice tests")

    finally:
        db.close()


if __name__ == "__main__":
    main()
