#!/usr/bin/env python3
"""
Process captured Bluebook screenshots and map to database.

Uses OCR to extract question text, then fuzzy matches to database.

Usage:
    python3 process_screenshots.py data/bluebook_screenshots/test4_math_m1
"""

import sys
import json
from pathlib import Path
from PIL import Image
import pytesseract
from difflib import SequenceMatcher
import re


def extract_text_from_image(image_path):
    """Extract text from screenshot using OCR."""
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        print(f"  ⚠ OCR failed for {image_path.name}: {e}")
        return ""


def clean_text(text):
    """Clean OCR'd text for matching."""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove common OCR artifacts
    text = text.replace('|', 'I')
    text = text.strip()
    return text.lower()


def similarity_score(a, b):
    """Calculate similarity between two strings (0-1)."""
    return SequenceMatcher(None, a, b).ratio()


def search_database(query_text, subject_area='MATH'):
    """Search database for matching questions."""
    # Load core JSON
    if subject_area == 'MATH':
        json_file = Path(__file__).parent.parent / "data" / "math_core.json"
    else:
        json_file = Path(__file__).parent.parent / "data" / "reading_core.json"

    with open(json_file) as f:
        core_data = json.load(f)

    matches = []
    clean_query = clean_text(query_text)

    for uid, question in core_data.items():
        # Extract question content
        content = question.get('content', {})

        if isinstance(content, dict):
            prompt = content.get('prompt_html', '') or content.get('stem', '')
            stimulus = content.get('stimulus_html', '') or content.get('stimulus', '')
            combined = f"{stimulus} {prompt}"
        else:
            combined = str(content)

        # Remove HTML tags
        combined = re.sub(r'<[^>]+>', '', combined)
        clean_db = clean_text(combined)

        # Calculate similarity
        score = similarity_score(clean_query, clean_db)

        if score > 0.3:  # Threshold for potential matches
            matches.append({
                'uid': uid,
                'questionId': question.get('questionId'),
                'external_id': question.get('external_id'),
                'score': score,
                'difficulty': question.get('difficulty'),
                'skill_cd': question.get('skill_cd'),
                'skill_desc': question.get('skill_desc'),
                'preview': combined[:200]
            })

    # Sort by score
    matches.sort(key=lambda x: x['score'], reverse=True)
    return matches[:5]  # Top 5 matches


def process_screenshots(screenshot_dir):
    """Process all screenshots in directory."""
    screenshot_dir = Path(screenshot_dir)

    if not screenshot_dir.exists():
        print(f"❌ Directory not found: {screenshot_dir}")
        return

    # Determine subject from directory name
    dir_name = screenshot_dir.name.lower()
    subject_area = 'MATH' if 'math' in dir_name else 'READING_WRITING'

    # Get all screenshots
    screenshots = sorted(screenshot_dir.glob("question_*.png"))

    if not screenshots:
        print(f"❌ No screenshots found in {screenshot_dir}")
        return

    print(f"\n{'='*60}")
    print(f"Processing {len(screenshots)} screenshots")
    print(f"Subject: {subject_area}")
    print(f"{'='*60}\n")

    mappings = []

    for i, img_path in enumerate(screenshots, 1):
        print(f"\n[{i}/{len(screenshots)}] Processing: {img_path.name}")

        # Extract text
        text = extract_text_from_image(img_path)

        if not text or len(text) < 20:
            print(f"  ⚠ Not enough text extracted (likely image/math question)")
            # Save for manual review
            mappings.append({
                'screenshot': img_path.name,
                'question_num': i,
                'matched_uid': None,
                'confidence': 0,
                'note': 'Manual review needed - insufficient OCR text'
            })
            continue

        print(f"  Extracted text: {text[:100]}...")

        # Search database
        matches = search_database(text, subject_area)

        if not matches:
            print(f"  ❌ No matches found")
            mappings.append({
                'screenshot': img_path.name,
                'question_num': i,
                'matched_uid': None,
                'confidence': 0,
                'note': 'No database match found'
            })
            continue

        # Show top match
        best_match = matches[0]
        print(f"  ✓ Best match: {best_match['uid']} (confidence: {best_match['score']:.1%})")
        print(f"    Skill: {best_match['skill_desc']}")
        print(f"    Preview: {best_match['preview'][:80]}...")

        # Auto-accept if confidence is high
        if best_match['score'] > 0.7:
            print(f"  ✓ Auto-accepted (high confidence)")
            mappings.append({
                'screenshot': img_path.name,
                'question_num': i,
                'matched_uid': best_match['uid'],
                'questionId': best_match['questionId'],
                'external_id': best_match['external_id'],
                'confidence': best_match['score'],
                'difficulty': best_match['difficulty'],
                'skill': best_match['skill_desc']
            })
        else:
            print(f"  ⚠ Low confidence - needs manual review")
            # Show all top 5 for manual selection
            print("\n  Top 5 matches:")
            for j, m in enumerate(matches, 1):
                print(f"    {j}. {m['uid']} ({m['score']:.1%}) - {m['skill_desc']}")

            mappings.append({
                'screenshot': img_path.name,
                'question_num': i,
                'matched_uid': best_match['uid'],
                'questionId': best_match['questionId'],
                'confidence': best_match['score'],
                'top_matches': [m['uid'] for m in matches],
                'note': 'Low confidence - verify manually'
            })

    # Save mappings
    output_file = screenshot_dir / "mapping.json"
    with open(output_file, 'w') as f:
        json.dump({
            'test': screenshot_dir.name,
            'subject_area': subject_area,
            'total_questions': len(screenshots),
            'auto_matched': sum(1 for m in mappings if m.get('confidence', 0) > 0.7),
            'needs_review': sum(1 for m in mappings if m.get('confidence', 0) <= 0.7),
            'mappings': mappings
        }, f, indent=2)

    print(f"\n{'='*60}")
    print(f"✓ Processing complete!")
    print(f"✓ Mapping saved to: {output_file}")
    print(f"\nStats:")
    print(f"  Total questions: {len(screenshots)}")
    print(f"  Auto-matched: {sum(1 for m in mappings if m.get('confidence', 0) > 0.7)}")
    print(f"  Needs review: {sum(1 for m in mappings if m.get('confidence', 0) <= 0.7)}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 process_screenshots.py <screenshot_directory>")
        print("Example: python3 process_screenshots.py data/bluebook_screenshots/test4_math_m1")
        sys.exit(1)

    process_screenshots(sys.argv[1])
