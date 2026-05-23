#!/usr/bin/env python3
"""
Extract question CONTENT from Bluebook cache (not just IDs).
Since UUIDs don't match, we need to extract the actual question text and match by content.
"""

import subprocess
import json
import re
from pathlib import Path

NETWORK_CACHE = Path.home() / "Library/Containers/org.collegeboard.bluebook/Data/Library/Caches/WebKit/NetworkCache/Version 17"


def find_cached_responses():
    """Find all cached network responses."""
    blobs = list(NETWORK_CACHE.glob("**/*-blob"))
    print(f"Found {len(blobs)} cached response blobs")
    return blobs


def extract_json_from_blob(blob_file):
    """Try to extract JSON from a cached blob file."""
    try:
        # Read as bytes first
        with open(blob_file, 'rb') as f:
            content = f.read()

        # Try to decode as UTF-8
        try:
            text = content.decode('utf-8')
        except:
            text = content.decode('latin-1', errors='ignore')

        # Look for JSON objects containing question data
        # Bluebook might send questions as JSON arrays or objects
        json_objects = []

        # Try to find JSON patterns
        # Look for {"questionId": or {"prompt": or similar patterns
        matches = re.finditer(r'\{[^{}]*(?:"questionId"|"prompt"|"stimulus")[^{}]*\}', text, re.DOTALL)
        for match in matches:
            try:
                obj = json.loads(match.group())
                json_objects.append(obj)
            except:
                pass

        # Also try extracting arrays
        array_matches = re.finditer(r'\[[^\[\]]*\{[^\}]*"prompt"[^\}]*\}[^\[\]]*\]', text, re.DOTALL)
        for match in array_matches:
            try:
                arr = json.loads(match.group())
                if isinstance(arr, list):
                    json_objects.extend(arr)
            except:
                pass

        return json_objects

    except Exception as e:
        return []


def main():
    print("="*60)
    print("Bluebook Content Extractor")
    print("="*60)

    # Find cached responses
    blobs = find_cached_responses()

    if not blobs:
        print("\n❌ No cached network responses found!")
        print("Make sure you've opened Bluebook and loaded practice test questions.")
        return

    # Extract JSON from blobs
    all_questions = []

    print("\nExtracting question content from cache...")
    for i, blob in enumerate(blobs):
        if i % 100 == 0:
            print(f"  Progress: {i}/{len(blobs)} files...")

        json_objects = extract_json_from_blob(blob)
        all_questions.extend(json_objects)

    print(f"\n✓ Extracted {len(all_questions)} potential question objects")

    # Filter to actual questions (have prompt or stimulus)
    questions_with_content = [
        q for q in all_questions
        if any(key in q for key in ['prompt', 'stimulus', 'prompt_html', 'stimulus_html'])
    ]

    print(f"✓ {len(questions_with_content)} objects contain question content")

    if questions_with_content:
        print("\nFirst 3 question objects:")
        for i, q in enumerate(questions_with_content[:3], 1):
            print(f"\n--- Question {i} ---")
            print(json.dumps(q, indent=2)[:500] + "...")

        # Save to file
        output_file = Path(__file__).parent.parent / "data" / "bluebook_extracted_questions.json"
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w') as f:
            json.dump(questions_with_content, f, indent=2)

        print(f"\n✓ Saved to: {output_file}")
    else:
        print("\n❌ No question content found in cache")
        print("This might mean:")
        print("  1. Questions are cached differently")
        print("  2. Need to look in IndexedDB instead")
        print("  3. Questions are encrypted or compressed")


if __name__ == "__main__":
    main()
