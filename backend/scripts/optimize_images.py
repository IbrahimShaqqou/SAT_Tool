#!/usr/bin/env python3
"""
Optimize Oversized Images

Compresses and optimizes base64-encoded images that are too large.

Issues addressed:
- Q.D.: 19 questions with oversized images (58KB-165KB)
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


def extract_base64_images(html: str) -> list[dict]:
    """Extract base64 images from HTML."""
    if not html:
        return []

    # Pattern for base64 image data URLs
    pattern = r'data:image/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+/=]+)'
    matches = re.finditer(pattern, html)

    images = []
    for match in matches:
        img_format = match.group(1)
        img_data = match.group(2)
        full_match = match.group(0)

        try:
            decoded = base64.b64decode(img_data)
            size_kb = len(decoded) / 1024

            images.append({
                'format': img_format,
                'data': img_data,
                'full_match': full_match,
                'size_kb': size_kb,
                'decoded': decoded
            })
        except:
            continue

    return images


def optimize_image(img_data: bytes, target_size_kb: int = 50) -> tuple[bytes, str]:
    """
    Optimize image to target size.

    Returns (optimized_bytes, format)
    """
    try:
        img = Image.open(BytesIO(img_data))

        # Convert RGBA to RGB if needed
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Try different quality levels
        for quality in [85, 75, 65, 55, 45]:
            output = BytesIO()
            img.save(output, format='JPEG', quality=quality, optimize=True)
            output_size = len(output.getvalue()) / 1024

            if output_size <= target_size_kb:
                return output.getvalue(), 'jpeg'

        # If still too large, resize
        output = BytesIO()
        img.thumbnail((800, 600), Image.Resampling.LANCZOS)
        img.save(output, format='JPEG', quality=75, optimize=True)
        return output.getvalue(), 'jpeg'

    except Exception as e:
        print(f"Error optimizing image: {e}")
        return img_data, 'png'


def optimize_question_images(db: Session, skill_id: int, size_threshold_kb: int = 50) -> dict:
    """Optimize images in questions for specified skill."""

    stats = {
        'checked': 0,
        'images_found': 0,
        'images_optimized': 0,
        'bytes_saved': 0,
        'errors': 0
    }

    questions = db.query(Question).filter(
        Question.skill_id == skill_id,
        Question.is_active == True
    ).all()

    for q in questions:
        stats['checked'] += 1

        try:
            needs_fix = False

            # Check prompt_html for images
            if q.prompt_html:
                images = extract_base64_images(q.prompt_html)
                stats['images_found'] += len(images)

                new_html = q.prompt_html
                for img in images:
                    if img['size_kb'] > size_threshold_kb:
                        print(f"  Question {q.external_id}: Optimizing {img['size_kb']:.1f}KB image...")

                        optimized, fmt = optimize_image(img['decoded'], size_threshold_kb)
                        optimized_b64 = base64.b64encode(optimized).decode('utf-8')
                        optimized_size_kb = len(optimized) / 1024

                        # Replace in HTML
                        new_data_url = f"data:image/{fmt};base64,{optimized_b64}"
                        new_html = new_html.replace(img['full_match'], new_data_url)

                        stats['images_optimized'] += 1
                        stats['bytes_saved'] += len(img['decoded']) - len(optimized)

                        print(f"    {img['size_kb']:.1f}KB → {optimized_size_kb:.1f}KB (saved {img['size_kb'] - optimized_size_kb:.1f}KB)")
                        needs_fix = True

                if needs_fix:
                    q.prompt_html = new_html

            # Check choices
            if q.choices_json:
                new_choices = []
                for choice in q.choices_json:
                    images = extract_base64_images(choice)
                    stats['images_found'] += len(images)

                    new_choice = choice
                    for img in images:
                        if img['size_kb'] > size_threshold_kb:
                            optimized, fmt = optimize_image(img['decoded'], size_threshold_kb)
                            optimized_b64 = base64.b64encode(optimized).decode('utf-8')

                            new_data_url = f"data:image/{fmt};base64,{optimized_b64}"
                            new_choice = new_choice.replace(img['full_match'], new_data_url)

                            stats['images_optimized'] += 1
                            stats['bytes_saved'] += len(img['decoded']) - len(optimized)
                            needs_fix = True

                    new_choices.append(new_choice)

                if needs_fix:
                    q.choices_json = new_choices

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
    print("Image Optimization Script")
    print("=" * 60)

    # Skill ID with oversized images: Q.D. (43)
    skill_id = 43
    size_threshold = 50  # KB

    db = SessionLocal()

    try:
        print(f"\nOptimizing images in skill {skill_id} (threshold: {size_threshold}KB)...")
        print()

        stats = optimize_question_images(db, skill_id, size_threshold)

        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)
        print(f"Questions checked: {stats['checked']}")
        print(f"Images found: {stats['images_found']}")
        print(f"Images optimized: {stats['images_optimized']}")
        print(f"Bytes saved: {stats['bytes_saved'] / 1024:.1f} KB")
        print(f"Errors: {stats['errors']}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
