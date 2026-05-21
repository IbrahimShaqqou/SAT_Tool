#!/usr/bin/env python3
"""
Audit all questions for skill P.C. (Nonlinear functions, skill_id=35)
Checks for:
- Math rendering issues (broken LaTeX, missing symbols)
- Oversized images
- Missing content (blank prompts, missing choices)
"""

import requests
import json
import re
from html.parser import HTMLParser

# API configuration
API_BASE = "http://localhost:8000/api/v1"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzkzMzg0NzksInN1YiI6IjhlN2U0Y2ExLWQxYTQtNDM4ZS05NDk1LTllOTIxNzY3ZjczMCIsInR5cGUiOiJhY2Nlc3MifQ.Fa7raD_KStCMRWEzmRoPQDR-kY9RWzxxd8696UUVbNM"

SKILL_ID = 35
SKILL_NAME = "P.C. - Nonlinear functions"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

class HTMLTextExtractor(HTMLParser):
    """Extract text content from HTML"""
    def __init__(self):
        super().__init__()
        self.text_parts = []

    def handle_data(self, data):
        self.text_parts.append(data)

    def get_text(self):
        return ''.join(self.text_parts).strip()

def extract_text(html):
    """Extract plain text from HTML"""
    if not html:
        return ""
    parser = HTMLTextExtractor()
    parser.feed(html)
    return parser.get_text()

def check_broken_latex(html):
    """Check for potentially broken LaTeX rendering"""
    if not html:
        return []
    issues = []

    # Look for common LaTeX rendering issues
    patterns = [
        (r'\$\$[^$]*\$\$', 'Display math mode'),
        (r'\$[^$]*\$', 'Inline math mode'),
        (r'\\[a-zA-Z]+', 'LaTeX commands'),
        (r'\{[^}]*\}', 'LaTeX braces'),
        (r'_\{[^}]*\}', 'Subscripts'),
        (r'\^\{[^}]*\}', 'Superscripts'),
    ]

    for pattern, name in patterns:
        matches = re.findall(pattern, html)
        if matches:
            issues.append(f"{name}: {len(matches)} occurrences")

    return issues

def check_images(html):
    """Check for images and estimate their size"""
    if not html:
        return []
    issues = []

    # Find img tags
    img_pattern = r'<img[^>]*>'
    images = re.findall(img_pattern, html)

    for img in images:
        # Check for width/height attributes
        width_match = re.search(r'width[=:]\s*["\']?(\d+)', img, re.IGNORECASE)
        height_match = re.search(r'height[=:]\s*["\']?(\d+)', img, re.IGNORECASE)

        if width_match:
            width = int(width_match.group(1))
            if width > 800:
                issues.append(f"Oversized image width: {width}px")

        if height_match:
            height = int(height_match.group(1))
            if height > 600:
                issues.append(f"Oversized image height: {height}px")

    if images and not issues:
        issues.append(f"{len(images)} image(s) found (size OK)")

    return issues

def audit_question(q):
    """Audit a single question"""
    issues = []

    question_id = q.get('id', 'unknown')

    # Check prompt
    prompt_html = q.get('prompt_html', '')
    prompt_text = extract_text(prompt_html)

    if not prompt_text or len(prompt_text.strip()) < 5:
        issues.append("Missing or empty prompt")

    # Check for LaTeX issues in prompt
    latex_issues = check_broken_latex(prompt_html)
    if latex_issues:
        issues.extend([f"Prompt LaTeX: {issue}" for issue in latex_issues])

    # Check for images in prompt
    img_issues = check_images(prompt_html)
    if 'Oversized' in str(img_issues):
        issues.extend([f"Prompt: {issue}" for issue in img_issues if 'Oversized' in issue])

    # Check passage if exists
    passage_html = q.get('passage_html', '')
    if passage_html:
        passage_text = extract_text(passage_html)
        if not passage_text or len(passage_text.strip()) < 5:
            issues.append("Empty passage (stimulus)")

        # Check passage images
        passage_img_issues = check_images(passage_html)
        if 'Oversized' in str(passage_img_issues):
            issues.extend([f"Passage: {issue}" for issue in passage_img_issues if 'Oversized' in issue])

    # Check answer choices
    choices = q.get('choices', [])
    if q.get('answer_type') == 'MCQ':
        if not choices or len(choices) != 4:
            issues.append(f"Missing choices (expected 4, got {len(choices)})")

        for i, choice in enumerate(choices):
            choice_content = choice.get('content', '')
            choice_text = extract_text(choice_content)
            if not choice_text or len(choice_text.strip()) < 1:
                issues.append(f"Empty choice {chr(65+i)}")

            # Check choice images
            choice_img_issues = check_images(choice_content)
            if 'Oversized' in str(choice_img_issues):
                issues.extend([f"Choice {chr(65+i)}: {issue}" for issue in choice_img_issues if 'Oversized' in issue])

    return issues

def main():
    print(f"Auditing questions for skill: {SKILL_NAME} (ID: {SKILL_ID})")
    print("=" * 80)

    # Fetch all questions for this skill with full details
    url = f"{API_BASE}/questions?skill_id={SKILL_ID}&limit=500&full=true"
    print(f"\nFetching questions from: {url}")

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return

    data = response.json()
    questions = data.get('items', [])
    total = data.get('total', 0)

    print(f"Total questions: {total}")
    print(f"Questions fetched: {len(questions)}")
    print()

    # Audit each question
    issues_found = []

    for i, q in enumerate(questions, 1):
        question_id = q.get('id', 'unknown')
        issues = audit_question(q)

        if issues:
            issues_found.append({
                'number': i,
                'id': question_id,
                'issues': issues
            })
            print(f"Question {i} (ID: {question_id[:8]}...): {len(issues)} issue(s)")
            for issue in issues:
                print(f"  - {issue}")
            print()

    # Summary
    print("=" * 80)
    print(f"SUMMARY:")
    print(f"Skill: {SKILL_NAME}")
    print(f"Total questions checked: {len(questions)}")
    print(f"Issues found: {len(issues_found)}")
    print()

    if issues_found:
        print("Questions with issues:")
        for item in issues_found:
            print(f"  - Question {item['number']} (ID: {item['id'][:8]}...): {len(item['issues'])} issue(s)")
    else:
        print("No visual defects found! All questions look good.")

if __name__ == "__main__":
    main()
