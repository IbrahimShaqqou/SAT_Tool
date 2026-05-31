#!/usr/bin/env python3
"""
Import PT6's 10 unmatched questions as placeholder questions.
These questions exist in Practice Test 6 but aren't in College Board's public API.
They will be imported with null difficulty/score_band to be calibrated later from student data.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.question import Question
from app.models.enums import AnswerType, SubjectArea


def strip_html(text: str) -> str:
    """Basic HTML stripping for text extraction."""
    import re
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_correct_answer(html: str, text: str) -> dict:
    """Extract correct answer from HTML (marked with class='correct')."""
    import re

    # Find all list items
    choices = re.findall(r'<li[^>]*>(.*?)</li>', html, re.DOTALL)

    # Find which one has class="correct"
    for i, choice in enumerate(choices):
        if 'class="correct"' in choice or 'class=\\"correct\\"' in choice:
            return {"index": i}

    # Fallback: check if it's SPR (no choices)
    if not choices:
        # Look for student-produced response indicators
        return {"answers": []}  # Will need manual entry

    return {"index": 0}  # Default to A


def import_unmatched_questions(db: Session):
    """Import PT6's 10 unmatched questions."""

    # Load extraction
    data_dir = Path(__file__).parent.parent / "data"
    extraction_path = data_dir / "practice_test_6_questions_easy.json"

    with open(extraction_path) as f:
        extracted = json.load(f)

    # Unmatched question numbers (from our earlier analysis)
    unmatched_q_nums = [7, 21, 28, 30, 41, 42, 51, 53, 57, 63]

    print(f"Importing {len(unmatched_q_nums)} unmatched PT6 questions as placeholders...")
    print("="*60)

    imported_ids = {}

    for q_num in unmatched_q_nums:
        # Find in extraction
        q_data = next((q for q in extracted if q['questionNumber'] == q_num), None)
        if not q_data:
            print(f"  ⚠️  Q{q_num}: Not found in extraction")
            continue

        # Determine subject area
        subject_area = SubjectArea.MATH if q_num >= 55 else SubjectArea.READING_WRITING

        # Create synthetic external_id
        external_id = f"pt6-unmatched-q{q_num}"

        # Check if already exists
        existing = db.query(Question).filter(Question.external_id == external_id).first()
        if existing:
            print(f"  ⏭️  Q{q_num}: Already exists ({external_id})")
            imported_ids[q_num] = external_id
            continue

        # Extract prompt and choices
        prompt_html = q_data['html']
        full_text = q_data['text']

        # Parse choices (assume MCQ for now)
        import re
        choices_matches = re.findall(r'<li[^>]*>.*?<p>(.*?)</p>.*?</li>', prompt_html, re.DOTALL)

        # Determine answer type
        if len(choices_matches) >= 2:
            answer_type = AnswerType.MCQ
            choices_json = choices_matches
            correct_answer = extract_correct_answer(prompt_html, full_text)
        else:
            answer_type = AnswerType.SPR
            choices_json = None
            correct_answer = {"answers": []}  # Placeholder

        # Create question
        question = Question(
            external_id=external_id,
            ibn=None,  # Not from CB API
            subject_area=subject_area,
            domain_id=None,  # Unknown
            subdomain_id=None,
            skill_id=None,  # To be classified later
            answer_type=answer_type,
            difficulty=None,  # To be calibrated from student data
            score_band_range=None,  # To be calibrated
            prompt_html=prompt_html,
            choices_json=choices_json,
            correct_answer_json=correct_answer,
            explanation_html=None,
            irt_difficulty_b=None,
            irt_discrimination_a=None,
            irt_guessing_c=None,
            is_active=True,
            is_verified=False,
            needs_image_review=False,
            raw_import_json={
                "source": "PT6 mypractice extraction",
                "extraction_date": "2026-05-24",
                "note": "Unmatched question not in CB public API - needs calibration",
                "full_text": full_text[:500]
            },
            import_batch_id=None,
            imported_at=datetime.utcnow()
        )

        db.add(question)
        imported_ids[q_num] = external_id

        print(f"  ✓ Q{q_num}: Imported as {external_id} ({subject_area.value})")

    db.commit()

    print("="*60)
    print(f"Imported {len(imported_ids)} questions")

    # Output mapping for updating PT6 mapping files
    print("\nQuestion ID mappings (for updating PT6 mapping):")
    for q_num, ext_id in sorted(imported_ids.items()):
        print(f"  Q{q_num}: {ext_id}")

    return imported_ids


def main():
    print("="*60)
    print("PT6 Unmatched Questions Import")
    print("="*60)
    print("\nThis will import 10 PT6 questions as placeholders:")
    print("  - No difficulty/score_band (to be calibrated from student data)")
    print("  - No skill classification (needs manual review)")
    print("  - Marked as unverified")
    print()

    response = input("Continue? (y/N): ").strip().lower()
    if response != 'y':
        print("Aborted.")
        return

    db = SessionLocal()
    try:
        imported_ids = import_unmatched_questions(db)

        print("\n" + "="*60)
        print("NEXT STEPS:")
        print("="*60)
        print("1. Update PT6 mapping files with these external IDs")
        print("2. Re-run seed_practice_test_6.py to include these questions")
        print("3. After students complete PT6, run IRT calibration to set difficulty/score_band")

    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
