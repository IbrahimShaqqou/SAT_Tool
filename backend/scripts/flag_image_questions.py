"""
flag_image_questions.py
-----------------------
Sets needs_image_review = True on any active question whose prompt_html or
stimulus_html (from raw_import_json) contains a non-math <img> tag.

These are raster graph/diagram images that should eventually be replaced with
SVG or HTML equivalents matching the app's standard question format.

Usage:
    python3 -m scripts.flag_image_questions [--dry-run]
"""

import argparse
import re
import sys
from pathlib import Path

# Allow running as a module from the backend dir
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models.question import Question  # noqa: E402

# Matches any <img that is NOT a math-img (class="math-img" or class="math_img")
# We look for <img tags whose class does NOT contain math-img/math_img
_NON_MATH_IMG = re.compile(
    r"<img\b(?!(?:[^>]*?\bclass\s*=\s*[\"'][^\"']*math.img[^\"']*[\"']))[^>]*>",
    re.IGNORECASE,
)


def has_non_math_image(html: str) -> bool:
    """Return True if html contains a non-math <img> tag."""
    if not html:
        return False
    return bool(_NON_MATH_IMG.search(html))


def run(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        questions = db.query(Question).filter(Question.is_active == True).all()  # noqa: E712
        print(f"Checking {len(questions)} active questions...")

        to_flag: list[Question] = []
        for q in questions:
            # Check prompt_html
            if has_non_math_image(q.prompt_html or ""):
                to_flag.append(q)
                continue

            # Check stimulus_html inside raw_import_json
            raw = q.raw_import_json or {}
            stimulus = raw.get("stimulus_html", "") or raw.get("stimulusHtml", "") or ""
            if has_non_math_image(stimulus):
                to_flag.append(q)

        print(f"Questions needing image review: {len(to_flag)}")

        if dry_run:
            print("[DRY RUN] No changes written.")
            for q in to_flag[:20]:
                print(f"  Would flag: {q.id}")
            return

        for q in to_flag:
            q.needs_image_review = True

        db.commit()
        print(f"Flagged {len(to_flag)} questions with needs_image_review = True.")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Flag questions with graph/diagram images for review")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be flagged without writing")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
