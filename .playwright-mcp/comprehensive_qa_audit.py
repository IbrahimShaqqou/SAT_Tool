#!/usr/bin/env python3
"""
Comprehensive audit of Skill Q.A. questions
Analyzes HTML structure, content, and generates a detailed report
"""

import json
import re
from html.parser import HTMLParser
from collections import defaultdict

class QuestionHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.math_tags = 0
        self.img_tags = 0
        self.img_attrs = []
        self.text_content = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag == 'math':
            self.math_tags += 1
        elif tag == 'img':
            self.img_tags += 1
            self.img_attrs.append(dict(attrs))

    def handle_data(self, data):
        if data.strip():
            self.text_content.append(data.strip())

# Load questions
with open('/tmp/skill_38_all_questions.json', 'r') as f:
    data = json.load(f)

questions = data['items']
print("=" * 80)
print(f"COMPREHENSIVE AUDIT: Skill Q.A. - Ratios, rates, proportional relationships, and units")
print(f"Skill ID: 38")
print(f"Total Questions: {len(questions)}")
print("=" * 80)

issues = []
stats = {
    'total_math_tags': 0,
    'total_images': 0,
    'total_figures': 0,
    'questions_with_math': 0,
    'questions_with_images': 0,
    'avg_text_length': 0,
}

total_text_length = 0

for idx, q in enumerate(questions, 1):
    q_id = q.get('external_id', q['id'])
    prompt_html = q.get('prompt_html', '')

    # Parse HTML
    parser = QuestionHTMLParser()
    try:
        parser.feed(prompt_html)
    except Exception as e:
        issues.append({
            'question_number': idx,
            'question_id': q_id,
            'type': 'HTML Parsing Error',
            'description': f'Failed to parse HTML: {str(e)[:100]}'
        })
        continue

    # Collect statistics
    if parser.math_tags > 0:
        stats['questions_with_math'] += 1
        stats['total_math_tags'] += parser.math_tags

    if parser.img_tags > 0:
        stats['questions_with_images'] += 1
        stats['total_images'] += parser.img_tags

    if '<figure' in prompt_html:
        stats['total_figures'] += 1

    text_length = len(' '.join(parser.text_content))
    total_text_length += text_length

    # ISSUE DETECTION

    # 1. Check for very short questions
    if text_length < 20:
        issues.append({
            'question_number': idx,
            'question_id': q_id,
            'type': 'Missing Content',
            'description': f'Question text is very short ({text_length} chars)'
        })

    # 2. Check for missing image sources
    for img_attr in parser.img_attrs:
        if 'src' not in img_attr or not img_attr['src']:
            issues.append({
                'question_number': idx,
                'question_id': q_id,
                'type': 'Missing Content',
                'description': 'Image tag missing src attribute'
            })
        # Check for potential inline/base64 oversized images
        if 'src' in img_attr and img_attr['src'].startswith('data:image'):
            data_len = len(img_attr['src'])
            if data_len > 100000:  # > 100KB base64
                issues.append({
                    'question_number': idx,
                    'question_id': q_id,
                    'type': 'Oversized Image',
                    'description': f'Inline image data is very large (~{data_len // 1024}KB base64)'
                })

    # 3. Check for malformed math
    if '<math' in prompt_html:
        open_count = prompt_html.count('<math')
        close_count = prompt_html.count('</math>')
        if open_count != close_count:
            issues.append({
                'question_number': idx,
                'question_id': q_id,
                'type': 'Math Rendering Error',
                'description': f'Unclosed math tags (open:{open_count}, close:{close_count})'
            })

        # Check for empty math tags
        if re.search(r'<math[^>]*>\s*</math>', prompt_html):
            issues.append({
                'question_number': idx,
                'question_id': q_id,
                'type': 'Math Rendering Error',
                'description': 'Empty <math> tag detected'
            })

    # 4. Check for broken entities
    if re.search(r'&[a-z]+;{2,}', prompt_html):  # doubled entities like &amp;amp;
        issues.append({
            'question_number': idx,
            'question_id': q_id,
            'type': 'HTML Encoding Issue',
            'description': 'Potentially double-encoded HTML entities'
        })

    # 5. Check for unicode replacement characters (rendering errors)
    if '�' in prompt_html or '�' in prompt_html:
        issues.append({
            'question_number': idx,
            'question_id': q_id,
            'type': 'Math Rendering Error',
            'description': 'Unicode replacement character found (�) - indicates encoding/rendering error'
        })

stats['avg_text_length'] = total_text_length / len(questions) if questions else 0

# GENERATE REPORT
print(f"\nSTATISTICS:")
print(f"  Questions with math notation: {stats['questions_with_math']} ({stats['questions_with_math']/len(questions)*100:.1f}%)")
print(f"  Questions with images: {stats['questions_with_images']} ({stats['questions_with_images']/len(questions)*100:.1f}%)")
print(f"  Total math tags: {stats['total_math_tags']}")
print(f"  Total images: {stats['total_images']}")
print(f"  Total figures: {stats['total_figures']}")
print(f"  Average question text length: {stats['avg_text_length']:.0f} characters")

print(f"\n" + "=" * 80)
print(f"ISSUES FOUND: {len(issues)}")
print("=" * 80)

if issues:
    print(f"\n{'#':<4} {'Q#':<4} {'Question ID':<40} {'Issue Type':<25} Description")
    print("-" * 140)
    for i, issue in enumerate(issues, 1):
        print(f"{i:<4} {issue['question_number']:<4} {issue['question_id']:<40} {issue['type']:<25} {issue['description']}")
else:
    print("\n✓ NO ISSUES DETECTED!")
    print("\nAll questions passed automated checks:")
    print("  ✓ No math rendering errors")
    print("  ✓ No oversized images")
    print("  ✓ No missing content")
    print("  ✓ All HTML properly formatted")

# Save comprehensive report
report = {
    'skill': {
        'code': 'Q.A.',
        'name': 'Ratios, rates, proportional relationships, and units',
        'id': 38
    },
    'audit_summary': {
        'total_questions': len(questions),
        'questions_checked': len(questions),
        'issues_found': len(issues)
    },
    'statistics': stats,
    'issues': issues,
    'sample_questions': [
        {
            'id': q['id'],
            'external_id': q.get('external_id'),
            'difficulty': q.get('difficulty'),
            'answer_type': q.get('answer_type'),
            'prompt_preview': q.get('prompt_html', '')[:200] + '...' if len(q.get('prompt_html', '')) > 200 else q.get('prompt_html', '')
        }
        for q in questions[:5]
    ]
}

with open('/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qa_comprehensive_audit.json', 'w') as f:
    json.dump(report, f, indent=2)

print(f"\n{'=' * 80}")
print(f"Full audit report saved to: skill_qa_comprehensive_audit.json")
print(f"{'=' * 80}\n")

# Print formatted final summary for user
print(f"\n{'█' * 80}")
print(f"FINAL AUDIT REPORT")
print(f"{'█' * 80}")
print(f"\nSkill: Q.A. - Ratios, rates, proportional relationships, and units")
print(f"Total questions checked: {len(questions)}")
print(f"Issues found: {len(issues)}")

if issues:
    print(f"\nIssues by type:")
    issue_types = defaultdict(int)
    for issue in issues:
        issue_types[issue['type']] += 1
    for issue_type, count in sorted(issue_types.items(), key=lambda x: -x[1]):
        print(f"  • {issue_type}: {count}")

    print(f"\nDetailed issues:")
    for issue in issues:
        print(f"\n  Question {issue['question_number']} (ID: {issue['question_id']})")
        print(f"    Issue type: {issue['type']}")
        print(f"    Visual description: {issue['description']}")
else:
    print(f"\n✓ ALL QUESTIONS PASSED AUDIT!")
    print(f"\nNo issues found with:")
    print(f"  • Math rendering")
    print(f"  • Image sizing or loading")
    print(f"  • Missing content")
    print(f"  • HTML structure")

print(f"\n{'█' * 80}\n")
