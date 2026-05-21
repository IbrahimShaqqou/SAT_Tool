#!/usr/bin/env python3
"""
Fix LaTeX Rendering Issues

Fixes questions with unrendered LaTeX delimiters (\( and \)) by converting them
to proper MathJax-compatible format or removing them if the content is simple.

Issues addressed:
- H.A.: 16 questions with LaTeX errors
- H.E.: 15 questions with LaTeX errors
- H.B.: 27 questions with LaTeX errors
"""

import os
import sys
import re
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.question import Question


def fix_latex_delimiters(html: str) -> str:
    """
    Fix LaTeX delimiters in HTML content.

    Converts \(...\) to proper format for MathJax rendering.
    """
    if not html:
        return html

    # Pattern to find \(...\) with content
    pattern = r'\\?\\\((.+?)\\?\\\)'

    def replace_latex(match):
        content = match.group(1).strip()
        # Wrap in span with proper MathJax delimiters
        return f'<span class="math-inline">\\({content}\\)</span>'

    fixed_html = re.sub(pattern, replace_latex, html)

    return fixed_html


def fix_question_latex(db: Session, skill_ids: list[int]) -> dict:
    """Fix LaTeX rendering for questions in specified skills."""

    stats = {
        'checked': 0,
        'fixed': 0,
        'errors': 0,
        'by_skill': {}
    }

    for skill_id in skill_ids:
        questions = db.query(Question).filter(
            Question.skill_id == skill_id,
            Question.is_active == True
        ).all()

        skill_fixed = 0

        for q in questions:
            stats['checked'] += 1

            try:
                needs_fix = False

                # Check and fix prompt_html
                if q.prompt_html and ('\\(' in q.prompt_html or '\\)' in q.prompt_html):
                    original = q.prompt_html
                    q.prompt_html = fix_latex_delimiters(q.prompt_html)
                    if q.prompt_html != original:
                        needs_fix = True

                # Check and fix choices
                if q.choices_json:
                    new_choices = []
                    for choice in q.choices_json:
                        if '\\(' in choice or '\\)' in choice:
                            new_choices.append(fix_latex_delimiters(choice))
                            needs_fix = True
                        else:
                            new_choices.append(choice)
                    if needs_fix:
                        q.choices_json = new_choices

                # Check and fix explanation
                if q.explanation_html and ('\\(' in q.explanation_html or '\\)' in q.explanation_html):
                    q.explanation_html = fix_latex_delimiters(q.explanation_html)
                    needs_fix = True

                if needs_fix:
                    stats['fixed'] += 1
                    skill_fixed += 1

            except Exception as e:
                print(f"Error fixing question {q.id}: {e}")
                stats['errors'] += 1

        stats['by_skill'][skill_id] = skill_fixed

    # Commit all changes
    try:
        db.commit()
        print("✓ Changes committed to database")
    except Exception as e:
        print(f"✗ Error committing changes: {e}")
        db.rollback()
        raise

    return stats


def main():
    """Main execution."""
    print("=" * 60)
    print("LaTeX Rendering Fix Script")
    print("=" * 60)

    # Skill IDs with LaTeX issues
    # H.A. (31), H.E. (34), H.B. (32)
    skill_ids = [31, 34, 32]

    db = SessionLocal()

    try:
        print("\nFixing LaTeX delimiters in questions...")
        print(f"Target skills: {skill_ids}")
        print()

        stats = fix_question_latex(db, skill_ids)

        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)
        print(f"Questions checked: {stats['checked']}")
        print(f"Questions fixed: {stats['fixed']}")
        print(f"Errors: {stats['errors']}")
        print("\nBy skill:")
        for skill_id, count in stats['by_skill'].items():
            print(f"  Skill {skill_id}: {count} questions fixed")

    finally:
        db.close()


if __name__ == "__main__":
    main()
