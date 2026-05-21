#!/usr/bin/env python3
"""
Audit all questions for skill P.B. (ID 36)
Checks for parsing errors, oversized images, and missing content
"""

import json
import sys

# Load questions from API response
with open('/tmp/pb_questions.json', 'r') as f:
    data = json.load(f)

questions = data.get('items', [])
print(f"Total questions to audit: {len(questions)}\n")

issues_found = []

for idx, q in enumerate(questions, 1):
    q_issues = []
    q_id = q.get('id', 'unknown')

    # Check for missing content
    prompt = q.get('prompt_html', '')
    passage = q.get('passage_html', '')

    if not prompt or len(prompt.strip()) < 10:
        q_issues.append("Missing or very short prompt")

    # Check for broken LaTeX/math indicators
    if '\\' in prompt and 'math' not in prompt.lower():
        q_issues.append("Possible unrendered LaTeX in prompt")

    if passage and '\\' in passage and 'math' not in passage.lower():
        q_issues.append("Possible unrendered LaTeX in passage")

    # Check for image size indicators in HTML
    if 'width' in prompt.lower() or 'height' in prompt.lower():
        # Extract size if possible
        if 'width="' in prompt:
            import re
            widths = re.findall(r'width="(\d+)"', prompt)
            for w in widths:
                if int(w) > 1000:
                    q_issues.append(f"Possibly oversized image width: {w}px in prompt")

    if passage and ('width' in passage.lower() or 'height' in passage.lower()):
        if 'width="' in passage:
            import re
            widths = re.findall(r'width="(\d+)"', passage)
            for w in widths:
                if int(w) > 1000:
                    q_issues.append(f"Possibly oversized image width: {w}px in passage")

    # Check answer choices
    choices = q.get('choices', [])
    answer_type = q.get('answer_type', 'MCQ')

    if answer_type == 'MCQ' and len(choices) != 4:
        q_issues.append(f"MCQ has {len(choices)} choices (expected 4)")

    # Check for empty choices
    for cidx, choice in enumerate(choices):
        content = choice.get('content', '')
        if not content or len(content.strip()) < 2:
            q_issues.append(f"Choice {chr(65+cidx)} is empty or too short")

    # Check explanation
    explanation = q.get('explanation_html', '')
    if not explanation:
        # This is OK, not all questions have explanations yet
        pass

    if q_issues:
        issues_found.append({
            'question_number': idx,
            'question_id': q_id,
            'issues': q_issues
        })
        print(f"Question {idx} (ID: {q_id[:8]}...):")
        for issue in q_issues:
            print(f"  - {issue}")
        print()

print(f"\n{'='*60}")
print(f"AUDIT SUMMARY")
print(f"{'='*60}")
print(f"Total questions checked: {len(questions)}")
print(f"Questions with issues: {len(issues_found)}")
print(f"Issues found: {sum(len(q['issues']) for q in issues_found)}")

if len(issues_found) == 0:
    print("\n✓ No issues detected in static content analysis!")
else:
    print("\nNote: Visual rendering issues require browser inspection.")
    print("Run with --visual flag to inspect each question in browser.")
