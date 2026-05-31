#!/usr/bin/env python3
"""
Seed Practice Test 6 into the database from mapping files.

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


def seed_practice_test_6(db: Session):
    existing = db.query(PracticeTest).filter(PracticeTest.test_number == 6).first()
    if existing:
        print(f"Practice Test 6 already exists (ID: {existing.id})")
        resp = input("Delete and recreate? (y/N): ")
        if resp.lower() != 'y':
            print("Aborted.")
            return
        db.delete(existing)
        db.commit()
        print("Deleted existing Practice Test 6")

    data_dir = Path(__file__).parent.parent / "data" / "practice_test_mappings"

    # Try simple mapping first (after manual matching), fall back to detailed
    easy_path = data_dir / "practice_test_6_modules_1_2_easy_simple.json"
    if not easy_path.exists():
        easy_path = data_dir / "practice_test_6_modules_1_2_easy.json"

    hard_path = data_dir / "practice_test_6_modules_1_2_hard_simple.json"
    if not hard_path.exists():
        hard_path = data_dir / "practice_test_6_modules_1_2_hard.json"

    easy = load_mapping(easy_path)
    hard = load_mapping(hard_path)

    print("\nLoaded mappings:")
    print(f"  Easy: RW M1 {len(easy['rw_module_1'])} + RW M2 easier {len(easy['rw_module_2_easier'])} "
          f"+ Math M1 {len(easy['math_module_1'])} + Math M2 easier {len(easy['math_module_2_easier'])}")
    print(f"  Hard: RW M2 harder {len(hard['rw_module_2_harder'])} + "
          f"Math M2 harder {len(hard['math_module_2_harder'])}")

    practice_test = PracticeTest(
        test_number=6,
        test_name="SAT Practice Test 6",
        description="Official College Board Practice Test 6 with both adaptive Module 2 variants",
        is_active=True,
        date_extracted=datetime(2026, 5, 24),
        note=(
            "Extracted from mypractice.collegeboard.org on 2026-05-24. "
            "85/98 matched to question bank via fuzzy text matching (60% threshold); "
            "13 unmatched questions need manual review or import from mypractice extraction."
        ),
        test_metadata={
            "source": "mypractice.collegeboard.org",
            "extraction_method": "Playwright console scraper + fuzzy text matching",
            "match_rate_easy": "85/98 (86.7%)",
            "match_rate_hard": "85/98 (86.7%)",
            "unmatched_questions": 13,
            "unmatched_breakdown": {
                "rw_module_1": 3,
                "rw_module_2_easier": 8,
                "rw_module_2_harder": 8,
                "math_module_1": 2,
            },
        },
    )
    db.add(practice_test)
    db.flush()
    print(f"\nCreated Practice Test 6 (ID: {practice_test.id})")

    # Module 1 lists are shared between variants — use easy's
    # Handle both simple (list of uids) and detailed (list of objects) formats
    def extract_uids(module_list):
        if not module_list:
            return []
        if isinstance(module_list[0], dict):
            return [item['uId'] for item in module_list if item.get('uId')]
        return [uid for uid in module_list if uid is not None]

    rw_m1 = extract_uids(easy["rw_module_1"])
    math_m1 = extract_uids(easy["math_module_1"])

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
            "question_uids": extract_uids(easy["rw_module_2_easier"]),
            "difficulty_distribution": {"easy": 50, "medium": 40, "hard": 10},
        },
        # R/W Module 2 (harder)
        {
            "module_number": 2,
            "module_type": "module_2_harder",
            "subject_area": "reading_writing",
            "time_limit_minutes": 32,
            "question_uids": extract_uids(hard["rw_module_2_harder"]),
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
            "question_uids": extract_uids(easy["math_module_2_easier"]),
            "difficulty_distribution": {"easy": 50, "medium": 40, "hard": 10},
        },
        # Math Module 2 (harder)
        {
            "module_number": 2,
            "module_type": "module_2_harder",
            "subject_area": "math",
            "time_limit_minutes": 35,
            "question_uids": extract_uids(hard["math_module_2_harder"]),
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
    print(f"\nSuccessfully seeded Practice Test 6")
    all_uids = (rw_m1 + extract_uids(easy['rw_module_2_easier']) +
                extract_uids(hard['rw_module_2_harder']) + math_m1 +
                extract_uids(easy['math_module_2_easier']) +
                extract_uids(hard['math_module_2_harder']))
    print(f"6 module variants, {len(set(all_uids))} unique questions")


def main():
    print("=" * 60)
    print("Seeding Practice Test 6 into Database")
    print("=" * 60)
    db = SessionLocal()
    try:
        seed_practice_test_6(db)
    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
