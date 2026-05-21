#!/usr/bin/env python3
"""
Fix HTML Parsing Errors

Fixes questions with HTML tag imbalances and malformed markup.

Issues addressed:
- H.E.: 15 questions with HTML parsing errors
"""

import os
import sys
from pathlib import Path
from html.parser import HTMLParser

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.question import Question


class HTMLValidator(HTMLParser):
    """Validate HTML and track unclosed tags."""

    def __init__(self):
        super().__init__()
        self.tags = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        # Self-closing tags
        if tag in ['img', 'br', 'hr', 'input', 'meta', 'link']:
            return
        self.tags.append(tag)

    def handle_endtag(self, tag):
        if self.tags and self.tags[-1] == tag:
            self.tags.pop()
        elif tag not in ['img', 'br', 'hr', 'input', 'meta', 'link']:
            self.errors.append(f"Unexpected closing tag: {tag}")

    def has_errors(self):
        return len(self.tags) > 0 or len(self.errors) > 0


def validate_html(html: str) -> tuple[bool, list]:
    """Validate HTML and return (is_valid, errors)."""
    if not html:
        return True, []

    validator = HTMLValidator()
    try:
        validator.feed(html)
        return not validator.has_errors(), validator.tags + validator.errors
    except Exception as e:
        return False, [str(e)]


def fix_html_tags(html: str) -> str:
    """
    Attempt to fix common HTML tag issues.

    This is a basic fix - for complex cases, manual review may be needed.
    """
    if not html:
        return html

    # Close common unclosed tags
    html = html.strip()

    # Count opening and closing tags for common elements
    for tag in ['span', 'div', 'p', 'strong', 'em']:
        open_count = html.count(f'<{tag}')
        close_count = html.count(f'</{tag}>')

        # Add missing closing tags at the end
        if open_count > close_count:
            for _ in range(open_count - close_count):
                html += f'</{tag}>'

    return html


def fix_question_html(db: Session, skill_id: int) -> dict:
    """Fix HTML parsing errors for questions in specified skill."""

    stats = {
        'checked': 0,
        'fixed': 0,
        'needs_review': 0,
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
            needs_review = False

            # Check prompt_html
            if q.prompt_html:
                is_valid, errors = validate_html(q.prompt_html)
                if not is_valid:
                    original = q.prompt_html
                    q.prompt_html = fix_html_tags(q.prompt_html)

                    # Verify fix
                    is_valid_after, _ = validate_html(q.prompt_html)
                    if is_valid_after:
                        needs_fix = True
                    else:
                        needs_review = True
                        print(f"Question {q.external_id} needs manual review: {errors[:3]}")

            # Check choices
            if q.choices_json:
                new_choices = []
                for choice in q.choices_json:
                    is_valid, errors = validate_html(choice)
                    if not is_valid:
                        fixed_choice = fix_html_tags(choice)
                        is_valid_after, _ = validate_html(fixed_choice)
                        if is_valid_after:
                            new_choices.append(fixed_choice)
                            needs_fix = True
                        else:
                            new_choices.append(choice)
                            needs_review = True
                    else:
                        new_choices.append(choice)

                if needs_fix:
                    q.choices_json = new_choices

            if needs_fix:
                stats['fixed'] += 1
            if needs_review:
                stats['needs_review'] += 1

        except Exception as e:
            print(f"Error fixing question {q.id}: {e}")
            stats['errors'] += 1

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
    print("HTML Parsing Fix Script")
    print("=" * 60)

    # Skill ID with HTML issues: H.E. (34)
    skill_id = 34

    db = SessionLocal()

    try:
        print(f"\nFixing HTML parsing errors in skill {skill_id}...")
        print()

        stats = fix_question_html(db, skill_id)

        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)
        print(f"Questions checked: {stats['checked']}")
        print(f"Questions fixed: {stats['fixed']}")
        print(f"Questions needing manual review: {stats['needs_review']}")
        print(f"Errors: {stats['errors']}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
