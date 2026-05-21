#!/usr/bin/env python3
"""
Comprehensive visual audit for skill Q.G. questions
Fetches all questions and performs detailed HTML/content analysis
"""
import json
import requests
import re
from html.parser import HTMLParser
from collections import defaultdict

# Question IDs for skill Q.G. (ID 44)
QUESTION_IDS = [
    "1c9af892-be86-4847-a6a6-c9a2795e9ab3",
    "4786b417-7e36-4f45-9b78-d35304aea30e",
    "330bb7d4-2c30-481f-906c-ea919e89fee4",
    "3624b6fa-71b0-43ab-b826-66db2c111abc",
    "8bbcd11e-6726-4f6c-a67e-2485e527f6b0",
    "b1d2c90b-4ee1-4e68-adb9-24428ff3b7ac",
    "bb4fb16c-6294-464e-a7af-69ff6282b082",
    "e77f58cd-35bd-4f63-bb95-144c1fd07759",
    "0ffc9ae2-0b44-4deb-a8cd-e08b83c1a14b",
    "a7b57a1e-23f1-4e50-bade-1e6282f5e69e",
    "a7d6856e-b65a-4dc7-9d0f-1dae5801402f",
]

API_BASE = "http://localhost:8000/api/v1"

class HTMLContentChecker(HTMLParser):
    """Parse HTML and check for content issues"""
    def __init__(self):
        super().__init__()
        self.images = []
        self.has_math = False
        self.text_content = []

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            attr_dict = dict(attrs)
            self.images.append(attr_dict)
        elif tag in ['math', 'span'] and any(k == 'class' and 'katex' in v for k, v in attrs):
            self.has_math = True

    def handle_data(self, data):
        if data.strip():
            self.text_content.append(data.strip())

def analyze_html_content(html):
    """Analyze HTML for visual rendering issues"""
    issues = []

    if not html or len(html.strip()) < 5:
        return ["Empty or missing content"], {}

    # Parse HTML
    parser = HTMLContentChecker()
    try:
        parser.feed(html)
    except Exception as e:
        issues.append(f"HTML parsing error: {str(e)}")

    # Check for broken LaTeX
    if '\\(' in html or '\\)' in html or '\\[' in html or '\\]' in html:
        issues.append("Raw LaTeX delimiters found (may not render)")

    # Check for missing alt text on images
    for img in parser.images:
        if not img.get('alt') or len(img.get('alt', '').strip()) < 3:
            issues.append(f"Image missing proper alt text: {img.get('src', 'unknown')[:50]}")

        # Check for oversized images (if width/height specified)
        try:
            width = int(img.get('width', 0))
            height = int(img.get('height', 0))
            if width > 1000:
                issues.append(f"Oversized image width: {width}px")
            if height > 800:
                issues.append(f"Oversized image height: {height}px")
        except (ValueError, TypeError):
            pass

    # Check for very long lines (could indicate formatting issues)
    lines = html.split('\n')
    for i, line in enumerate(lines):
        if len(line.strip()) > 500 and '<' not in line:  # Long text line without HTML
            issues.append(f"Very long text line ({len(line)} chars) on line {i+1}")

    metadata = {
        'image_count': len(parser.images),
        'has_math': parser.has_math,
        'text_length': sum(len(t) for t in parser.text_content),
        'html_length': len(html),
    }

    return issues, metadata

def audit_question(question_id, index):
    """Comprehensive audit of a single question"""
    print(f"\n{'='*80}")
    print(f"Question {index}/11: {question_id}")
    print(f"{'='*80}")

    try:
        # Fetch question data
        response = requests.get(f"{API_BASE}/questions/{question_id}")
        if response.status_code != 200:
            error_msg = f"Failed to fetch (HTTP {response.status_code})"
            print(f"❌ ERROR: {error_msg}")
            return {"id": question_id, "error": error_msg}

        data = response.json()

        all_issues = defaultdict(list)

        # Basic info
        print(f"IBN: {data.get('ibn', 'N/A')}")
        print(f"Answer Type: {data.get('answer_type', 'N/A')}")
        print(f"Difficulty: {data.get('difficulty', 'N/A')}")

        # Audit prompt
        prompt_html = data.get("prompt_html", "")
        prompt_issues, prompt_meta = analyze_html_content(prompt_html)
        if prompt_issues:
            all_issues["Prompt"].extend(prompt_issues)

        print(f"Prompt: {prompt_meta.get('text_length', 0)} chars, {prompt_meta.get('image_count', 0)} images")

        # Audit passage if present
        passage_html = data.get("passage_html", "")
        if passage_html:
            passage_issues, passage_meta = analyze_html_content(passage_html)
            if passage_issues:
                all_issues["Passage"].extend(passage_issues)
            print(f"Passage: {passage_meta.get('text_length', 0)} chars, {passage_meta.get('image_count', 0)} images")

        # Audit choices
        choices = data.get("choices_json", [])
        if data.get("answer_type") in ["MCQ", "multiple_choice"]:
            if not choices or len(choices) == 0:
                all_issues["Choices"].append("No answer choices found")
            else:
                print(f"Choices: {len(choices)}")
                for i, choice in enumerate(choices, 1):
                    choice_html = choice.get("html", "")
                    choice_issues, choice_meta = analyze_html_content(choice_html)
                    if choice_issues:
                        all_issues[f"Choice {i}"].extend(choice_issues)
                    if choice_meta['text_length'] == 0 and choice_meta['image_count'] == 0:
                        all_issues[f"Choice {i}"].append("Empty choice")

        # Summary
        if all_issues:
            print(f"\n⚠️  ISSUES FOUND ({sum(len(v) for v in all_issues.values())}):")
            for category, issues in all_issues.items():
                for issue in issues:
                    print(f"  - [{category}] {issue}")
        else:
            print("\n✅ No visual issues detected")

        return {
            "id": question_id,
            "ibn": data.get("ibn"),
            "answer_type": data.get("answer_type"),
            "difficulty": data.get("difficulty"),
            "prompt_meta": prompt_meta,
            "choice_count": len(choices),
            "issues": dict(all_issues),
        }

    except Exception as e:
        error_msg = str(e)
        print(f"❌ ERROR: {error_msg}")
        return {"id": question_id, "error": error_msg}

def main():
    print("="*80)
    print("SKILL Q.G. COMPREHENSIVE VISUAL AUDIT")
    print("Skill: Evaluating statistical claims: Observational studies and experiments")
    print(f"Total questions to check: {len(QUESTION_IDS)}")
    print("="*80)

    results = []
    for i, qid in enumerate(QUESTION_IDS, 1):
        result = audit_question(qid, i)
        results.append(result)

    # Summary
    print("\n" + "="*80)
    print("AUDIT SUMMARY")
    print("="*80)
    print(f"Total questions checked: {len(results)}")

    questions_with_issues = [r for r in results if r.get("issues") and len(r["issues"]) > 0]
    errors = [r for r in results if r.get("error")]
    questions_ok = len(results) - len(questions_with_issues) - len(errors)

    print(f"Questions with visual issues: {len(questions_with_issues)}")
    print(f"Questions with errors: {len(errors)}")
    print(f"Questions OK: {questions_ok}")

    if questions_with_issues:
        print("\n" + "-"*80)
        print("DETAILED ISSUES:")
        print("-"*80)
        for r in questions_with_issues:
            print(f"\nQuestion ID: {r['id']}")
            print(f"IBN: {r.get('ibn', 'N/A')}")
            print(f"Difficulty: {r.get('difficulty', 'N/A')}")
            for category, issues in r['issues'].items():
                for issue in issues:
                    print(f"  - [{category}] {issue}")

    # Save results
    output_file = "/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qg_comprehensive_audit.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "="*80)
    print(f"Results saved to: {output_file}")
    print("="*80)

if __name__ == "__main__":
    main()
