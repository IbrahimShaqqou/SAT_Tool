#!/usr/bin/env python3
"""
Audit all questions for skill 32 (Linear functions) by fetching from API
and checking for rendering issues.
"""
import json
import requests
import sys

def fetch_all_questions_for_skill(skill_id=32):
    """Fetch all questions for a given skill ID."""
    base_url = "http://localhost:8000/api/v1/questions"
    page = 1
    page_size = 50
    all_questions = []

    while True:
        response = requests.get(base_url, params={
            'skill_id': skill_id,
            'page': page,
            'page_size': page_size
        })
        data = response.json()
        all_questions.extend(data['items'])

        if len(all_questions) >= data['total']:
            break
        page += 1

    return all_questions

def check_question_for_issues(question):
    """Check a question for potential rendering issues."""
    issues = []
    q_id = question['id']

    # Check for broken LaTeX patterns
    prompt = question.get('prompt_html', '')
    stimulus = question.get('stimulus_html', '')

    # Common LaTeX error patterns
    if '\\(' in prompt or '\\)' in prompt:
        # Check for malformed LaTeX
        if prompt.count('\\(') != prompt.count('\\)'):
            issues.append("Mismatched LaTeX delimiters in prompt")

    if stimulus and ('\\(' in stimulus or '\\)' in stimulus):
        if stimulus.count('\\(') != stimulus.count('\\)'):
            issues.append("Mismatched LaTeX delimiters in stimulus")

    # Check for image URLs and potential oversizing
    if '<img' in prompt.lower():
        # Count img tags
        img_count = prompt.lower().count('<img')
        if img_count > 0:
            issues.append(f"Contains {img_count} image(s) in prompt - needs visual check")

    if stimulus and '<img' in stimulus.lower():
        img_count = stimulus.lower().count('<img')
        if img_count > 0:
            issues.append(f"Contains {img_count} image(s) in stimulus - needs visual check")

    # Check for missing/empty content
    if not prompt or prompt.strip() == '':
        issues.append("Missing or empty prompt")

    # Check answer choices for MCQ
    if question['answer_type'] == 'MCQ':
        choices = question.get('answer_choices', [])
        if not choices or len(choices) < 4:
            issues.append(f"Insufficient answer choices ({len(choices) if choices else 0})")

        for i, choice in enumerate(choices):
            choice_text = choice.get('choice_html', '')
            if not choice_text or choice_text.strip() == '':
                issues.append(f"Empty answer choice {chr(65+i)}")
            if '<img' in choice_text.lower():
                issues.append(f"Answer choice {chr(65+i)} contains image - needs visual check")

    # Check for mixed MathML and LaTeX (potential rendering conflict)
    if '<math' in prompt and '\\(' in prompt:
        issues.append("Mixed MathML and LaTeX in prompt")

    if stimulus and '<math' in stimulus and '\\(' in stimulus:
        issues.append("Mixed MathML and LaTeX in stimulus")

    return issues

def main():
    print("Fetching all questions for skill 32 (H.B. - Linear functions)...")
    questions = fetch_all_questions_for_skill(32)
    print(f"Total questions fetched: {len(questions)}\n")

    issues_found = 0
    questions_with_issues = []

    for i, question in enumerate(questions, 1):
        q_id = question['id']
        issues = check_question_for_issues(question)

        if issues:
            issues_found += len(issues)
            questions_with_issues.append({
                'id': q_id,
                'index': i,
                'issues': issues
            })

    # Print summary
    print("="*80)
    print(f"Skill: H.B. - Linear functions")
    print(f"Total questions checked: {len(questions)}")
    print(f"Questions with potential issues: {len(questions_with_issues)}")
    print(f"Total issues flagged: {issues_found}")
    print("="*80)
    print()

    if questions_with_issues:
        print("QUESTIONS REQUIRING MANUAL REVIEW:")
        print()
        for q in questions_with_issues:
            print(f"Question #{q['index']} - ID: {q['id']}")
            for issue in q['issues']:
                print(f"  - {issue}")
            print()
    else:
        print("No automated checks flagged issues. Manual visual review still recommended.")

    # Save full report
    report_file = '/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_32_audit_report.json'
    with open(report_file, 'w') as f:
        json.dump({
            'skill_id': 32,
            'skill_name': 'H.B. - Linear functions',
            'total_questions': len(questions),
            'questions_with_issues': len(questions_with_issues),
            'total_issues': issues_found,
            'flagged_questions': questions_with_issues,
            'all_question_ids': [q['id'] for q in questions]
        }, f, indent=2)

    print(f"\nFull report saved to: {report_file}")

    return 0 if issues_found == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
