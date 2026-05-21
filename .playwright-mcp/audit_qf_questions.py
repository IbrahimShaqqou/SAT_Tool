#!/usr/bin/env python3
"""
Audit Q.F. Skill Questions - Visual Defect Detection
Checks for: Math rendering errors, Oversized images, Missing content
"""

import json
import re
from html.parser import HTMLParser

class HTMLContentChecker(HTMLParser):
    """Parse HTML to check for various rendering issues"""
    def __init__(self):
        super().__init__()
        self.has_math = False
        self.has_images = False
        self.image_issues = []
        self.text_length = 0
        self.math_errors = []
        self.in_math = False
        self.current_math = ""

    def handle_starttag(self, tag, attrs):
        if tag == 'math':
            self.has_math = True
            self.in_math = True
            self.current_math = ""
        elif tag == 'img':
            self.has_images = True
            # Check for data URLs which might be oversized
            for attr_name, attr_value in attrs:
                if attr_name == 'src' and attr_value:
                    if attr_value.startswith('data:'):
                        # Estimate size from data URL length
                        data_size = len(attr_value)
                        if data_size > 100000:  # >100KB might be oversized
                            self.image_issues.append(f"Large data URL image (~{data_size//1024}KB)")
                    elif 'width' in dict(attrs):
                        width = dict(attrs).get('width', '')
                        if width and width.isdigit() and int(width) > 800:
                            self.image_issues.append(f"Image width={width}px (exceeds 800px)")

    def handle_endtag(self, tag):
        if tag == 'math':
            self.in_math = False
            # Check for rendering issues in math content
            if '�' in self.current_math:
                self.math_errors.append("Math contains replacement characters (�)")
            if 'alttext=' in self.current_math:
                self.math_errors.append("Math contains unprocessed alttext attribute")
            self.current_math = ""

    def handle_data(self, data):
        if self.in_math:
            self.current_math += data
        else:
            self.text_length += len(data.strip())

        # Check for LaTeX in regular text (should be in <math> tags)
        if not self.in_math:
            if '\\(' in data or '\\[' in data or '\\frac' in data or '\\sqrt' in data:
                self.math_errors.append("Unrendered LaTeX found in text content")

def audit_question(question, question_num):
    """Audit a single question for visual defects"""
    issues = []
    question_id = question.get('id', '')[:8] + '...'

    # Get the prompt HTML
    prompt_html = question.get('prompt_html', '')

    if not prompt_html:
        issues.append({
            'type': 'Missing Content',
            'description': 'No prompt_html found'
        })
        return issues

    # Parse the HTML
    parser = HTMLContentChecker()
    try:
        parser.feed(prompt_html)
    except Exception as e:
        issues.append({
            'type': 'HTML Parsing Error',
            'description': f'Failed to parse HTML: {str(e)}'
        })
        return issues

    # Check for math rendering errors
    if parser.math_errors:
        for error in parser.math_errors:
            issues.append({
                'type': 'Math Rendering Error',
                'description': error
            })

    # Check for image issues
    if parser.image_issues:
        for issue in parser.image_issues:
            issues.append({
                'type': 'Oversized Image',
                'description': issue
            })

    # Check for missing content
    if parser.text_length < 20:
        issues.append({
            'type': 'Missing Content',
            'description': f'Question text too short ({parser.text_length} characters)'
        })

    # Check for common HTML issues
    if '<math' in prompt_html and not parser.has_math:
        issues.append({
            'type': 'Math Rendering Error',
            'description': 'Math tag present but not properly parsed'
        })

    # Check for broken/malformed HTML
    if prompt_html.count('<math') != prompt_html.count('</math>'):
        issues.append({
            'type': 'HTML Structure Error',
            'description': 'Mismatched <math> tags'
        })

    return issues

def main():
    print("="*60)
    print("Q.F. - Inference from sample statistics and margin of error")
    print("Visual Defect Audit")
    print("="*60)
    print()

    # Load questions
    with open('.playwright-mcp/skill_39_api_questions.json', 'r') as f:
        questions = json.load(f)

    print(f"Total questions to audit: {len(questions)}")
    print()

    all_issues = []
    questions_with_issues = 0

    # Audit each question
    for i, question in enumerate(questions, 1):
        print(f"[{i}/{len(questions)}] Checking question {i}...", end='')

        issues = audit_question(question, i)

        if issues:
            questions_with_issues += 1
            all_issues.append({
                'questionNumber': i,
                'questionId': question.get('id', ''),
                'external_id': question.get('external_id', ''),
                'difficulty': question.get('difficulty', ''),
                'issues': issues
            })
            print(f" ⚠️  {len(issues)} issue(s) found")
        else:
            print(" ✓")

    print()
    print("="*60)
    print("AUDIT COMPLETE")
    print("="*60)

    # Generate report
    report = {
        'skill': 'Q.F. - Inference from sample statistics and margin of error',
        'skillId': 39,
        'skillCode': 'Q.F.',
        'totalQuestions': len(questions),
        'questionsWithIssues': questions_with_issues,
        'issuesFound': sum(len(item['issues']) for item in all_issues),
        'auditDate': '2026-05-21',
        'issues': all_issues
    }

    # Save report
    with open('.playwright-mcp/skill_39_audit/audit_report.json', 'w') as f:
        json.dump(report, f, indent=2)

    # Print summary
    print(f"Skill: Q.F. - Inference from sample statistics and margin of error")
    print(f"Total questions checked: {len(questions)}")
    print(f"Issues found: {questions_with_issues}")
    print()

    if all_issues:
        # Count issues by type
        issue_types = {}
        for item in all_issues:
            for issue in item['issues']:
                issue_type = issue['type']
                issue_types[issue_type] = issue_types.get(issue_type, 0) + 1

        print("Issues by type:")
        for issue_type, count in sorted(issue_types.items()):
            print(f"  {issue_type}: {count}")
        print()

        print("Detailed findings:")
        for item in all_issues:
            print(f"\nQuestion {item['questionNumber']} (ID: {item['questionId'][:8]}...)")
            for issue in item['issues']:
                print(f"  - [{issue['type']}] {issue['description']}")
    else:
        print("✓ No visual defects detected!")

    print()
    print(f"Full report saved to: .playwright-mcp/skill_39_audit/audit_report.json")
    print("="*60)

if __name__ == '__main__':
    main()
