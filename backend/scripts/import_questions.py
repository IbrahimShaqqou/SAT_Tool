#!/usr/bin/env python3
"""
Import questions from fetch script output into the database.

Usage:
    python scripts/import_questions.py [--math] [--reading] [--all]

Examples:
    python scripts/import_questions.py --all      # Import both math and reading
    python scripts/import_questions.py --math     # Import only math
    python scripts/import_questions.py --reading  # Import only reading
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.services.question_import import (
    seed_taxonomy,
    import_math_questions,
    import_reading_questions,
)


def main():
    parser = argparse.ArgumentParser(description="Import SAT questions into database")
    parser.add_argument("--math", action="store_true", help="Import math questions")
    parser.add_argument("--reading", action="store_true", help="Import reading questions")
    parser.add_argument("--all", action="store_true", help="Import all questions")
    parser.add_argument("--seed-only", action="store_true", help="Only seed taxonomy (domains)")
    args = parser.parse_args()

    # Default to --all if no flags provided
    if not any([args.math, args.reading, args.all, args.seed_only]):
        args.all = True

    db = SessionLocal()

    try:
        # Always seed taxonomy first
        print("Seeding taxonomy (domains)...")
        result = seed_taxonomy(db)
        print(f"  Created {result['domains_created']} domains")

        if args.seed_only:
            print("\nDone (seed only mode).")
            return

        # Import math questions
        if args.math or args.all:
            math_path = Path(__file__).parent.parent / "data" / "math_norm.json"
            if math_path.exists():
                print(f"\nImporting math questions from {math_path}...")
                result = import_math_questions(db)
                print(f"  Imported: {result['imported']}")
                print(f"  Skipped (duplicates): {result['skipped']}")
                print(f"  Errors: {result['errors']}")
                if result['error_details']:
                    print(f"  First errors: {result['error_details'][:3]}")
            else:
                print(f"\nWarning: {math_path} not found. Run fetch_math.py first.")

        # Import reading questions
        if args.reading or args.all:
            reading_path = Path(__file__).parent.parent / "data" / "reading_norm.json"
            if reading_path.exists():
                print(f"\nImporting reading questions from {reading_path}...")
                result = import_reading_questions(db)
                print(f"  Imported: {result['imported']}")
                print(f"  Skipped (duplicates): {result['skipped']}")
                print(f"  Errors: {result['errors']}")
                if result['error_details']:
                    print(f"  First errors: {result['error_details'][:3]}")
            else:
                print(f"\nWarning: {reading_path} not found. Run fetch_reading.py first.")

        print("\nDone!")

    finally:
        db.close()


if __name__ == "__main__":
    main()
