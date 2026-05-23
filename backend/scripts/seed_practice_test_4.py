#!/usr/bin/env python3
"""
Seed Practice Test 4 into database from mapping files.

Reads the practice test mapping JSONs and creates database records.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.practice_test import PracticeTest, PracticeTestModule


def load_mapping(mapping_path: Path) -> dict:
    """Load mapping JSON file."""
    with open(mapping_path) as f:
        return json.load(f)


def seed_practice_test_4(db: Session):
    """Seed Practice Test 4 with easy and hard variants."""

    # Check if already exists
    existing = db.query(PracticeTest).filter(
        PracticeTest.test_number == 4
    ).first()

    if existing:
        print(f"⚠️  Practice Test 4 already exists (ID: {existing.id})")
        response = input("Delete and recreate? (y/N): ")
        if response.lower() != 'y':
            print("Aborted.")
            return
        db.delete(existing)
        db.commit()
        print("✓ Deleted existing Practice Test 4")

    # Load mappings
    data_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"
    easy_mapping = load_mapping(data_dir / "practice_test_4_modules_1_2_easy.json")
    hard_mapping = load_mapping(data_dir / "practice_test_4_modules_1_2_hard.json")

    print(f"\nLoaded mappings:")
    print(f"  Easy variant: {sum(len(easy_mapping[k]) for k in ['rw_module_1', 'rw_module_2_easier', 'math_module_1', 'math_module_2_easier'])} questions")
    print(f"  Hard variant: {sum(len(hard_mapping[k]) for k in ['rw_module_1', 'rw_module_2_harder', 'math_module_1', 'math_module_2_harder'])} questions")

    # Create practice test
    practice_test = PracticeTest(
        test_number=4,
        test_name="SAT Practice Test 4",
        description="Official College Board Practice Test 4 with both adaptive Module 2 variants",
        is_active=True,
        date_extracted=datetime(2026, 5, 22),
        note="Extracted from mypractice.collegeboard.org on 2026-05-22. Complete mapping (100% match rate).",
        test_metadata={
            "source": "mypractice.collegeboard.org",
            "extraction_method": "JavaScript console scraper + fuzzy text matching",
            "match_rate_easy": "98/98 (100%)",
            "match_rate_hard": "98/98 (100%)",
            "unique_questions": 147  # 49 Module 1 + 49 easy M2 + 49 hard M2
        }
    )

    db.add(practice_test)
    db.flush()  # Get ID without committing

    print(f"\n✓ Created Practice Test 4 (ID: {practice_test.id})")

    # Module configurations
    modules_config = [
        # Reading/Writing Module 1 (same in both variants)
        {
            "module_number": 1,
            "module_type": "module_1_standard",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": easy_mapping["rw_module_1"],
            "difficulty_distribution": {"easy": 30, "medium": 40, "hard": 30}
        },
        # Reading/Writing Module 2 (easier variant)
        {
            "module_number": 2,
            "module_type": "module_2_easier",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": easy_mapping["rw_module_2_easier"],
            "difficulty_distribution": {"easy": 50, "medium": 40, "hard": 10}
        },
        # Reading/Writing Module 2 (harder variant)
        {
            "module_number": 2,
            "module_type": "module_2_harder",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": hard_mapping["rw_module_2_harder"],
            "difficulty_distribution": {"easy": 10, "medium": 40, "hard": 50}
        },
        # Math Module 1 (same in both variants)
        {
            "module_number": 1,
            "module_type": "module_1_standard",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": easy_mapping["math_module_1"],
            "difficulty_distribution": {"easy": 30, "medium": 40, "hard": 30}
        },
        # Math Module 2 (easier variant)
        {
            "module_number": 2,
            "module_type": "module_2_easier",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": easy_mapping["math_module_2_easier"],
            "difficulty_distribution": {"easy": 50, "medium": 40, "hard": 10}
        },
        # Math Module 2 (harder variant)
        {
            "module_number": 2,
            "module_type": "module_2_harder",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": hard_mapping["math_module_2_harder"],
            "difficulty_distribution": {"easy": 10, "medium": 40, "hard": 50}
        },
    ]

    # Create modules
    for config in modules_config:
        module = PracticeTestModule(
            practice_test_id=practice_test.id,
            module_number=config["module_number"],
            module_type=config["module_type"],
            subject_area=config["subject_area"],
            time_limit_minutes=config["time_limit_minutes"],
            question_count=len(config["question_uids"]),
            question_uids=config["question_uids"],
            difficulty_distribution=config["difficulty_distribution"]
        )
        db.add(module)

        subject_abbr = "RW" if config["subject_area"] == "reading_writing" else "Math"
        variant = ""
        if config["module_type"] != "module_1_standard":
            variant = " (easier)" if "easier" in config["module_type"] else " (harder)"

        print(f"  ✓ {subject_abbr} Module {config['module_number']}{variant}: {len(config['question_uids'])} questions")

    # Commit everything
    db.commit()

    print(f"\n✅ Successfully seeded Practice Test 4!")
    print(f"\nModules created:")
    print(f"  - RW Module 1: 27 questions (standard)")
    print(f"  - RW Module 2: 27 questions (easier variant)")
    print(f"  - RW Module 2: 27 questions (harder variant)")
    print(f"  - Math Module 1: 22 questions (standard)")
    print(f"  - Math Module 2: 22 questions (easier variant)")
    print(f"  - Math Module 2: 22 questions (harder variant)")
    print(f"\nTotal: 6 module variants, 147 unique questions")


def main():
    """Main entry point."""
    print("="*60)
    print("Seeding Practice Test 4 into Database")
    print("="*60)

    db = SessionLocal()
    try:
        seed_practice_test_4(db)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
