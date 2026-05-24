#!/usr/bin/env python3
"""
Seed Practice Test 5 into the database from mapping files.

Reuses the easy variant's Module 1 lists (R/W M1 + Math M1) for the hard
variant, since Module 1 questions are identical between adaptive paths.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.practice_test import PracticeTest, PracticeTestModule


def load_mapping(p: Path) -> dict:
    with open(p) as f:
        return json.load(f)


def seed_practice_test_5(db: Session):
    existing = db.query(PracticeTest).filter(PracticeTest.test_number == 5).first()
    if existing:
        print(f"Practice Test 5 already exists (ID: {existing.id})")
        resp = input("Delete and recreate? (y/N): ")
        if resp.lower() != 'y':
            print("Aborted.")
            return
        db.delete(existing)
        db.commit()
        print("Deleted existing Practice Test 5")

    data_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"
    easy = load_mapping(data_dir / "practice_test_5_modules_1_2_easy.json")
    hard = load_mapping(data_dir / "practice_test_5_modules_1_2_hard.json")

    print("\nLoaded mappings:")
    print(f"  Easy: RW M1 {len(easy['rw_module_1'])} + RW M2 easier {len(easy['rw_module_2_easier'])} "
          f"+ Math M1 {len(easy['math_module_1'])} + Math M2 easier {len(easy['math_module_2_easier'])}")
    print(f"  Hard: RW M2 harder {len(hard['rw_module_2_harder'])} + "
          f"Math M2 harder {len(hard['math_module_2_harder'])}")

    practice_test = PracticeTest(
        test_number=5,
        test_name="SAT Practice Test 5",
        description="Official College Board Practice Test 5 with both adaptive Module 2 variants",
        is_active=True,
        date_extracted=datetime(2026, 5, 23),
        note=(
            "Extracted from mypractice.collegeboard.org on 2026-05-23. "
            "97/98 R/W and 22/22 math matched to question bank; "
            "7 R/W questions were not in CB public Q-bank API and were imported "
            "directly from mypractice extraction (synthetic uIds prefixed pt5-)."
        ),
        test_metadata={
            "source": "mypractice.collegeboard.org",
            "extraction_method": "JS console scraper + fuzzy text matching + manual override",
            "match_rate_easy": "98/98 (100%)",
            "match_rate_hard": "98/98 (100%)",
            "synthetic_questions": 7,
        },
    )
    db.add(practice_test)
    db.flush()
    print(f"\nCreated Practice Test 5 (ID: {practice_test.id})")

    # Module 1 lists are shared between variants — use easy's
    rw_m1 = easy["rw_module_1"]
    math_m1 = easy["math_module_1"]

    modules_config = [
        # R/W Module 1
        {
            "module_number": 1,
            "module_type": "module_1_standard",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": rw_m1,
            "difficulty_distribution": {"easy": 30, "medium": 40, "hard": 30},
        },
        # R/W Module 2 (easier)
        {
            "module_number": 2,
            "module_type": "module_2_easier",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": easy["rw_module_2_easier"],
            "difficulty_distribution": {"easy": 50, "medium": 40, "hard": 10},
        },
        # R/W Module 2 (harder)
        {
            "module_number": 2,
            "module_type": "module_2_harder",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": hard["rw_module_2_harder"],
            "difficulty_distribution": {"easy": 10, "medium": 40, "hard": 50},
        },
        # Math Module 1
        {
            "module_number": 1,
            "module_type": "module_1_standard",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": math_m1,
            "difficulty_distribution": {"easy": 30, "medium": 40, "hard": 30},
        },
        # Math Module 2 (easier)
        {
            "module_number": 2,
            "module_type": "module_2_easier",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": easy["math_module_2_easier"],
            "difficulty_distribution": {"easy": 50, "medium": 40, "hard": 10},
        },
        # Math Module 2 (harder)
        {
            "module_number": 2,
            "module_type": "module_2_harder",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": hard["math_module_2_harder"],
            "difficulty_distribution": {"easy": 10, "medium": 40, "hard": 50},
        },
    ]

    for cfg in modules_config:
        module = PracticeTestModule(
            practice_test_id=practice_test.id,
            module_number=cfg["module_number"],
            module_type=cfg["module_type"],
            subject_area=cfg["subject_area"],
            time_limit_minutes=cfg["time_limit_minutes"],
            question_count=len(cfg["question_uids"]),
            question_uids=cfg["question_uids"],
            difficulty_distribution=cfg["difficulty_distribution"],
        )
        db.add(module)

        subj = "RW" if cfg["subject_area"] == "reading_writing" else "Math"
        variant_label = ""
        if cfg["module_type"] != "module_1_standard":
            variant_label = " (easier)" if "easier" in cfg["module_type"] else " (harder)"
        print(f"  {subj} Module {cfg['module_number']}{variant_label}: "
              f"{len(cfg['question_uids'])} questions")

    db.commit()
    print(f"\nSuccessfully seeded Practice Test 5")
    print(f"6 module variants, {len(set(rw_m1 + easy['rw_module_2_easier'] + hard['rw_module_2_harder'] + math_m1 + easy['math_module_2_easier'] + hard['math_module_2_harder']))} unique questions")


def main():
    print("=" * 60)
    print("Seeding Practice Test 5 into Database")
    print("=" * 60)
    db = SessionLocal()
    try:
        seed_practice_test_5(db)
    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
