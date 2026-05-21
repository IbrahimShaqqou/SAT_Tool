#!/usr/bin/env python3
"""
Add Width/Height Attributes to Images

Adds width and height attributes to img tags that are missing them.

Issues addressed:
- S.A.: 3 questions missing width/height attributes
"""

import os
import sys
import re
import base64
from io import BytesIO
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.question import Question

try:
    from PIL import Image
except ImportError:
    print("PIL/Pillow not installed. Installing...")
    os.system("pip install Pillow")
    from PIL import Image


def get_image_dimensions(img_data: bytes) -> tuple[int, int]:
    """Get dimensions of image from bytes."""
    try:
        img = Image.open(BytesIO(img_data))
        return img.size
    except:
        return None, None


def fix_img_tags(html: str) -> tuple[str, int]:
    """Add width/height attributes to img tags missing them."""
    if not html:
        return html, 0

    fixed_count = 0

    # Find all img tags
    pattern = r'<img\s+([^>]*?)/?>'

    def process_img_tag(match):
        nonlocal fixed_count
        attrs = match.group(1)

        # Check if already has width and height
        if 'width=' in attrs or 'height=' in attrs:
            return match.group(0)

        # Look for base64 image data
        src_match = re.search(r'src="data:image/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+/=]+)"', attrs)

        if src_match:
            try:
                img_data = base64.b64decode(src_match.group(2))
                width, height = get_image_dimensions(img_data)

                if width and height:
                    # Add width and height attributes
                    new_attrs = attrs
                    if 'style=' in new_attrs:
                        # Add to existing style
                        new_attrs = re.sub(
                            r'style="([^"]*)"',
                            f'style="\\1; max-width: 100%; height: auto;"',
                            new_attrs
                        )
                    else:
                        # Add new style attribute
                        new_attrs = f'{new_attrs} style="max-width: 100%; height: auto;"'

                    # Add width/height for layout stability
                    new_attrs = f'{new_attrs} width="{width}" height="{height}"'

                    fixed_count += 1
                    return f'<img {new_attrs} />'
            except:
                pass

        return match.group(0)

    fixed_html = re.sub(pattern, process_img_tag, html)
    return fixed_html, fixed_count


def fix_question_image_attrs(db: Session, skill_id: int) -> dict:
    """Add width/height attributes to images in questions for specified skill."""

    stats = {
        'checked': 0,
        'questions_fixed': 0,
        'images_fixed': 0,
        'errors': 0
    }

    questions = db.query(Question).filter(
        Question.skill_id == skill_id,
        Question.is_active == True
    ).all()

    for q in questions:
        stats['checked'] += 1

        try:
            question_fixed = False

            # Check prompt_html
            if q.prompt_html and '<img' in q.prompt_html:
                fixed_html, count = fix_img_tags(q.prompt_html)
                if count > 0:
                    q.prompt_html = fixed_html
                    stats['images_fixed'] += count
                    question_fixed = True
                    print(f"  Question {q.external_id}: Fixed {count} image(s)")

            # Check choices
            if q.choices_json:
                new_choices = []
                for choice in q.choices_json:
                    if '<img' in choice:
                        fixed_choice, count = fix_img_tags(choice)
                        if count > 0:
                            new_choices.append(fixed_choice)
                            stats['images_fixed'] += count
                            question_fixed = True
                        else:
                            new_choices.append(choice)
                    else:
                        new_choices.append(choice)

                if question_fixed:
                    q.choices_json = new_choices

            if question_fixed:
                stats['questions_fixed'] += 1

        except Exception as e:
            print(f"Error processing question {q.id}: {e}")
            stats['errors'] += 1

    # Commit all changes
    try:
        db.commit()
        print("\n✓ Changes committed to database")
    except Exception as e:
        print(f"\n✗ Error committing changes: {e}")
        db.rollback()
        raise

    return stats


def main():
    """Main execution."""
    print("=" * 60)
    print("Image Attributes Fix Script")
    print("=" * 60)

    # Skill ID with missing attributes: S.A. (46)
    skill_id = 46

    db = SessionLocal()

    try:
        print(f"\nAdding width/height attributes to images in skill {skill_id}...")
        print()

        stats = fix_question_image_attrs(db, skill_id)

        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)
        print(f"Questions checked: {stats['checked']}")
        print(f"Questions fixed: {stats['questions_fixed']}")
        print(f"Images fixed: {stats['images_fixed']}")
        print(f"Errors: {stats['errors']}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
