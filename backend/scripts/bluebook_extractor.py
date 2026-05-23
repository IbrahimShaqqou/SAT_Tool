#!/usr/bin/env python3
"""
Bluebook IndexedDB Extractor
Extracts question IDs from Bluebook's local IndexedDB cache.

Usage:
1. Open Bluebook and START a practice test (don't answer yet)
2. Let it load all questions
3. Run: python bluebook_extractor.py
4. Script extracts question IDs in order from IndexedDB
5. Match to database

Requires: pip install hexdump
"""

import subprocess
import re
import uuid
from pathlib import Path

BLUEBOOK_INDEXEDDB_PATH = Path.home() / "Library/Containers/org.collegeboard.bluebook/Data/Library/WebKit/WebsiteData"


def find_indexeddb_files():
    """Find all IndexedDB sqlite files."""
    pattern = "**/IndexedDB.sqlite3"
    files = list(BLUEBOOK_INDEXEDDB_PATH.glob(pattern))
    return files


def extract_question_ids_from_db(db_file):
    """Extract questionId UUIDs from IndexedDB using strings command."""
    print(f"Extracting from: {db_file}")

    # Use strings to extract text, look for UUID patterns
    cmd = f"strings {db_file}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    # UUID pattern: 8-4-4-4-12 hex characters
    uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

    found_uuids = []
    lines = result.stdout.split('\n')

    for i, line in enumerate(lines):
        # Look for "questionId" followed by UUID
        if 'questionId' in line.lower():
            # Check this line and next few lines for UUIDs
            for j in range(i, min(i+5, len(lines))):
                matches = re.findall(uuid_pattern, lines[j], re.IGNORECASE)
                found_uuids.extend(matches)

    # Also do a general UUID search
    general_uuids = re.findall(uuid_pattern, result.stdout, re.IGNORECASE)

    all_uuids = list(set(found_uuids + general_uuids))
    return all_uuids


def extract_with_hex_context(db_file):
    """Extract questionIds with hex dump context to preserve order."""
    print(f"Hex extraction from: {db_file}")

    cmd = f"hexdump -C {db_file}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

    # Find questionId markers with their byte offsets
    question_entries = []

    lines = result.stdout.split('\n')
    for i, line in enumerate(lines):
        if 'questionId' in line:
            # Extract byte offset (first part of hex dump line)
            offset_match = re.match(r'^([0-9a-f]+)', line)
            if offset_match:
                offset = int(offset_match.group(1), 16)

                # Look ahead for UUID in next few lines
                for j in range(i, min(i+10, len(lines))):
                    matches = re.findall(uuid_pattern, lines[j], re.IGNORECASE)
                    if matches:
                        for uuid_str in matches:
                            question_entries.append({
                                'offset': offset,
                                'uuid': uuid_str
                            })
                        break

    # Sort by offset to maintain order
    question_entries.sort(key=lambda x: x['offset'])

    # Remove duplicates while preserving order
    seen = set()
    ordered_uuids = []
    for entry in question_entries:
        if entry['uuid'] not in seen:
            seen.add(entry['uuid'])
            ordered_uuids.append(entry['uuid'])

    return ordered_uuids


def match_to_database(uuid_list):
    """Match extracted UUIDs to questions in database."""
    import sys
    from pathlib import Path
    backend_dir = Path(__file__).parent.parent
    sys.path.insert(0, str(backend_dir))

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings

    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    matched_questions = []

    for uuid_str in uuid_list:
        # Try matching by external_id or uid
        query = text("""
            SELECT id, uid, external_id, prompt_html, difficulty, skill_cd, subject_area
            FROM questions
            WHERE external_id::text = :uuid
               OR uid::text = :uuid
            LIMIT 1
        """)

        result = db.execute(query, {"uuid": uuid_str}).fetchone()

        if result:
            matched_questions.append({
                'extracted_uuid': uuid_str,
                'db_id': str(result[0]),
                'db_uid': str(result[1]),
                'db_external_id': str(result[2]) if result[2] else None,
                'difficulty': result[4],
                'skill': result[5],
                'subject': result[6],
                'prompt_preview': result[3][:100] if result[3] else ""
            })
        else:
            matched_questions.append({
                'extracted_uuid': uuid_str,
                'matched': False
            })

    db.close()
    return matched_questions


def main():
    print("="*60)
    print("Bluebook IndexedDB Question Extractor")
    print("="*60)

    # Find IndexedDB files
    db_files = find_indexeddb_files()

    if not db_files:
        print("❌ No IndexedDB files found!")
        print("Make sure Bluebook is installed and has been run at least once.")
        return

    print(f"\n✓ Found {len(db_files)} IndexedDB database(s)")

    all_uuids = []

    # Extract from largest database (most likely to have question data)
    db_files.sort(key=lambda x: x.stat().st_size, reverse=True)

    print("\nExtracting question IDs (this may take a moment)...\n")

    for db_file in db_files[:3]:  # Check top 3 largest
        print(f"Size: {db_file.stat().st_size / 1024 / 1024:.1f} MB")

        # Try ordered extraction first
        ordered_uuids = extract_with_hex_context(db_file)

        if ordered_uuids:
            print(f"  ✓ Found {len(ordered_uuids)} question IDs (order preserved)")
            all_uuids.extend(ordered_uuids)
        else:
            # Fallback to unordered extraction
            uuids = extract_question_ids_from_db(db_file)
            print(f"  ✓ Found {len(uuids)} UUIDs (unordered)")
            all_uuids.extend(uuids)

    # Remove duplicates
    unique_uuids = []
    seen = set()
    for uid in all_uuids:
        if uid not in seen:
            seen.add(uid)
            unique_uuids.append(uid)

    print(f"\n✓ Total unique question IDs extracted: {len(unique_uuids)}")

    if not unique_uuids:
        print("\n❌ No question UUIDs found!")
        print("\nMake sure:")
        print("  1. Bluebook is open")
        print("  2. You've started a practice test")
        print("  3. Questions have loaded")
        return

    # Save all UUIDs to file first
    uuid_file = Path(__file__).parent.parent / "data" / "bluebook_extracted_uuids.txt"
    uuid_file.parent.mkdir(parents=True, exist_ok=True)
    with open(uuid_file, 'w') as f:
        for uid in unique_uuids:
            f.write(uid + '\n')
    print(f"\n✓ All {len(unique_uuids)} UUIDs saved to: {uuid_file}")

    print("\nFirst 10 extracted UUIDs:")
    for i, uid in enumerate(unique_uuids[:10], 1):
        print(f"  {i}. {uid}")

    # Match to database
    print("\n" + "="*60)
    print("Matching to database...")
    print("="*60)

    matched = match_to_database(unique_uuids)

    matched_count = sum(1 for m in matched if m.get('matched', True))
    print(f"\n✓ Matched {matched_count}/{len(unique_uuids)} questions to database")

    # Show matches
    print("\nMatched Questions:")
    for i, match in enumerate(matched[:20], 1):  # Show first 20
        if match.get('matched', True):
            print(f"\n{i}. {match['extracted_uuid']}")
            print(f"   DB UID: {match['db_uid']}")
            print(f"   Subject: {match['subject']} | Difficulty: {match['difficulty']} | Skill: {match['skill']}")
            print(f"   Prompt: {match['prompt_preview']}...")
        else:
            print(f"\n{i}. {match['extracted_uuid']} - NOT FOUND IN DATABASE")

    # Save to file
    output_file = Path(__file__).parent.parent / "data" / "extracted_questions.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    import json
    with open(output_file, 'w') as f:
        json.dump({
            'total_extracted': len(unique_uuids),
            'matched_count': matched_count,
            'extracted_uuids': unique_uuids,
            'matched_questions': matched
        }, f, indent=2)

    print(f"\n✓ Results saved to: {output_file}")

    print("\n" + "="*60)
    print("Next Steps:")
    print("="*60)
    print("1. Note which practice test and module you had open")
    print("2. Save the extracted UUID list with test/module metadata")
    print("3. Repeat for other modules (Module 2 easier/harder branches)")
    print("4. Combine all mappings into practice_test_N.json")


if __name__ == "__main__":
    main()
