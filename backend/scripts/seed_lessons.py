"""
Seed lessons into the database from JSON files.
Run from backend directory: python -m scripts.seed_lessons
"""
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import engine
from app.models import Lesson, Skill


def load_lesson_from_json(db: Session, json_path: Path) -> bool:
    """Load a single lesson from a JSON file into the database."""
    with open(json_path) as f:
        data = json.load(f)

    skill_id = data.get("skill_id")

    # Check if skill exists
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        print(f"  Skill {skill_id} not found, skipping")
        return False

    # Check if lesson already exists for this skill
    existing = db.query(Lesson).filter(Lesson.skill_id == skill_id).first()
    if existing:
        # Update existing lesson
        existing.title = data.get("title")
        existing.subtitle = data.get("subtitle")
        existing.content_json = data.get("content")
        existing.estimated_minutes = data.get("estimated_minutes", 15)
        existing.difficulty_level = data.get("difficulty_level", "intermediate")
        existing.status = "published"
        existing.is_active = True
        print(f"  Updated existing lesson for skill {skill_id}: {data.get('title')}")
    else:
        # Create new lesson
        lesson = Lesson(
            skill_id=skill_id,
            domain_id=skill.domain_id,
            title=data.get("title"),
            subtitle=data.get("subtitle"),
            content_json=data.get("content"),
            estimated_minutes=data.get("estimated_minutes", 15),
            difficulty_level=data.get("difficulty_level", "intermediate"),
            status="published",
            is_active=True,
            display_order=skill_id,
        )
        db.add(lesson)
        print(f"  Created lesson for skill {skill_id}: {data.get('title')}")

    return True


def main():
    """Load all lesson JSON files from data/lessons directory."""
    lessons_dir = Path(__file__).parent.parent.parent / "data" / "lessons"

    if not lessons_dir.exists():
        print(f"Lessons directory not found: {lessons_dir}")
        return

    json_files = list(lessons_dir.glob("*.json"))
    if not json_files:
        print("No JSON files found in lessons directory")
        return

    print(f"Found {len(json_files)} lesson file(s)")

    with Session(engine) as db:
        loaded = 0
        for json_file in json_files:
            print(f"Processing: {json_file.name}")
            if load_lesson_from_json(db, json_file):
                loaded += 1

        db.commit()
        print(f"\nSuccessfully loaded/updated {loaded} lesson(s)")


if __name__ == "__main__":
    main()
