#!/usr/bin/env python3
"""
Analyze Skill Q.A. questions for potential issues by examining the HTML/data directly.
Then spot-check a sample with visual inspection.
"""

import json
import re
from collections import defaultdict

# Load questions
with open('/tmp/skill_38_all_questions.json', 'r') as f:
    data = json.load(f)

questions = data['items']
print(f"Analyzing {len(questions)} questions for skill Q.A. (ID 38)")
print("=" * 70)

issues = []
question_ids_to_check = []

for idx, q in enumerate(questions, 1):
    q_id = q['external_id'] or q['id']
    prompt_html = q.get('prompt_html', '')

    # Check 1: Math rendering - look for incomplete/malformed MathML
    if '<math' in prompt_html:
        # Check for unclosed math tags
        if prompt_html.count('<math') != prompt_html.count('</math>'):
            issues.append({
                'question_id': q_id,
                'question_number': idx,
                'type': 'Math Rendering Error',
                'description': 'Mismatched <math> tags (unclosed or malformed MathML)'
            })
            question_ids_to_check.append(q['id'])

        # Check for empty math tags
        if re.search(r'<math[^>]*>\s*</math>', prompt_html):
            issues.append({
                'question_id': q_id,
                'question_number': idx,
                'type': 'Math Rendering Error',
                'description': 'Empty <math> tag found'
            })
            question_ids_to_check.append(q['id'])

    # Check 2: Image references
    img_matches = re.findall(r'<img[^>]*>', prompt_html)
    for img_tag in img_matches:
        # Check for missing src
        if 'src=' not in img_tag:
            issues.append({
                'question_id': q_id,
                'question_number': idx,
                'type': 'Missing Content',
                'description': 'Image tag without src attribute'
            })
            question_ids_to_check.append(q['id'])

    # Check 3: Very short or empty content
    # Strip HTML tags for length check
    text_only = re.sub(r'<[^>]+>', '', prompt_html)
    text_only = text_only.strip()

    if len(text_only) < 10:
        issues.append({
            'question_id': q_id,
            'question_number': idx,
            'type': 'Missing Content',
            'description': f'Question text too short ({len(text_only)} characters after removing HTML)'
        })
        question_ids_to_check.append(q['id'])

    # Check 4: Broken HTML entities or special characters
    if '&lt;&lt;' in prompt_html or '&gt;&gt;' in prompt_html:
        # This might indicate double-encoded HTML
        issues.append({
            'question_id': q_id,
            'question_number': idx,
            'type': 'HTML Encoding Issue',
            'description': 'Potentially double-encoded HTML entities found'
        })
        question_ids_to_check.append(q['id'])

    # Check 5: Look for figure elements that should have descriptions
    if '<figure' in prompt_html and 'alttext' not in prompt_html.lower():
        # Figures should have alt text for accessibility
        issues.append({
            'question_id': q_id,
            'question_number': idx,
            'type': 'Accessibility Issue',
            'description': 'Figure element without alt text'
        })

# Generate report
print(f"\n{'Question ID':<40} {'Issue Type':<25} Description")
print("-" * 120)

if issues:
    for issue in issues:
        print(f"{issue['question_id']:<40} {issue['type']:<25} {issue['description']}")
else:
    print("No automated issues detected!")

print("\n" + "=" * 70)
print(f"AUTOMATED ANALYSIS SUMMARY:")
print(f"Total questions analyzed: {len(questions)}")
print(f"Potential issues detected: {len(issues)}")
print(f"Questions flagged for visual review: {len(set(question_ids_to_check))}")

# Save detailed report
report = {
    'skill': 'Q.A. - Ratios, rates, proportional relationships, and units',
    'skill_id': 38,
    'total_questions': len(questions),
    'automated_issues_found': len(issues),
    'issues': issues,
    'questions_for_visual_review': list(set(question_ids_to_check))[:10]  # Top 10 to check
}

with open('/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qa_automated_analysis.json', 'w') as f:
    json.dump(report, f, indent=2)

print(f"\nDetailed report saved to: skill_qa_automated_analysis.json")

# Print questions to visually inspect
if question_ids_to_check:
    print(f"\nTop 10 questions recommended for visual inspection:")
    for q_id in list(set(question_ids_to_check))[:10]:
        print(f"  - {q_id}")
else:
    print(f"\nRecommendation: Spot-check 5-10 random questions for visual verification")
    import random
    sample = random.sample([q['id'] for q in questions], min(10, len(questions)))
    for q_id in sample:
        print(f"  - {q_id}")
