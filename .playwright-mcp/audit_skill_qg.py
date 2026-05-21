#!/usr/bin/env python3
"""
Visual audit script for skill Q.G. questions
Fetches all questions for skill Q.G. and checks for visual issues
"""
import json
import requests
import re
from html.parser import HTMLParser

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

def check_latex_rendering(html):
    """Check for potential LaTeX rendering issues"""
    issues = []

    # Check for raw LaTeX delimiters that might not be rendered
    if "\\(" in html or "\\)" in html or "\\[" in html or "\\]" in html:
        issues.append("Raw LaTeX delimiters found (\\( \\) \\[ \\])")

    # Check for common LaTeX commands that might not render
    latex_commands = ["\\frac", "\\sqrt", "\\sum", "\\int", "\\lim"]
    for cmd in latex_commands:
        if cmd in html:
            issues.append(f"LaTeX command {cmd} found - verify rendering")

    return issues

def check_image_sizes(html):
    """Check for oversized images"""
    issues = []

    # Look for image tags
    img_pattern = r'<img[^>]*>'
    images = re.findall(img_pattern, html)

    for img in images:
        # Check for width/height attributes
        width_match = re.search(r'width=["\']?(\d+)', img)
        height_match = re.search(r'height=["\']?(\d+)', img)

        if width_match:
            width = int(width_match.group(1))
            if width > 800:
                issues.append(f"Large image width: {width}px")

        if height_match:
            height = int(height_match.group(1))
            if height > 600:
                issues.append(f"Large image height: {height}px")

    return issues

def check_missing_content(data):
    """Check for missing required content"""
    issues = []

    # Check prompt
    if not data.get("prompt_html") or len(data.get("prompt_html", "").strip()) < 10:
        issues.append("Missing or very short prompt")

    # Check choices for multiple choice
    if data.get("answer_type") == "multiple_choice":
        choices = data.get("choices_json", [])
        if not choices or len(choices) < 2:
            issues.append("Missing or insufficient answer choices")

        for i, choice in enumerate(choices):
            if not choice.get("html") or len(choice.get("html", "").strip()) < 1:
                issues.append(f"Choice {i+1} is empty or missing")

    # Check correct answer
    if not data.get("correct_answer_json"):
        issues.append("Missing correct answer")

    return issues

def audit_question(question_id, index):
    """Audit a single question"""
    print(f"\n{'='*80}")
    print(f"Question {index}/11: {question_id}")
    print(f"{'='*80}")

    try:
        # Fetch question data
        response = requests.get(f"{API_BASE}/questions/{question_id}")
        if response.status_code != 200:
            print(f"❌ ERROR: Failed to fetch question (status {response.status_code})")
            return {"id": question_id, "error": f"HTTP {response.status_code}"}

        data = response.json()

        # Check for issues
        all_issues = []

        # Check LaTeX rendering
        prompt_html = data.get("prompt_html", "")
        latex_issues = check_latex_rendering(prompt_html)
        if latex_issues:
            all_issues.extend([("Math rendering", issue) for issue in latex_issues])

        # Check images
        image_issues = check_image_sizes(prompt_html)
        if image_issues:
            all_issues.extend([("Oversized image", issue) for issue in image_issues])

        # Check choices
        if data.get("answer_type") == "multiple_choice":
            for choice in data.get("choices_json", []):
                choice_html = choice.get("html", "")
                choice_latex = check_latex_rendering(choice_html)
                if choice_latex:
                    all_issues.extend([("Math rendering in choice", issue) for issue in choice_latex])
                choice_images = check_image_sizes(choice_html)
                if choice_images:
                    all_issues.extend([("Oversized image in choice", issue) for issue in choice_images])

        # Check missing content
        missing_issues = check_missing_content(data)
        if missing_issues:
            all_issues.extend([("Missing content", issue) for issue in missing_issues])

        # Print results
        print(f"IBN: {data.get('ibn', 'N/A')}")
        print(f"Answer Type: {data.get('answer_type', 'N/A')}")
        print(f"Difficulty: {data.get('difficulty', 'N/A')}")

        if all_issues:
            print(f"\n⚠️  ISSUES FOUND ({len(all_issues)}):")
            for issue_type, issue_desc in all_issues:
                print(f"  - [{issue_type}] {issue_desc}")
        else:
            print("\n✅ No obvious issues detected")

        return {
            "id": question_id,
            "ibn": data.get("ibn"),
            "issues": all_issues,
        }

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return {"id": question_id, "error": str(e)}

def main():
    print("="*80)
    print("SKILL Q.G. VISUAL AUDIT")
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

    questions_with_issues = [r for r in results if r.get("issues")]
    errors = [r for r in results if r.get("error")]

    print(f"Questions with issues: {len(questions_with_issues)}")
    print(f"Questions with errors: {len(errors)}")
    print(f"Questions OK: {len(results) - len(questions_with_issues) - len(errors)}")

    if questions_with_issues:
        print("\n" + "-"*80)
        print("DETAILED ISSUES:")
        print("-"*80)
        for r in questions_with_issues:
            print(f"\nQuestion ID: {r['id']}")
            print(f"IBN: {r.get('ibn', 'N/A')}")
            for issue_type, issue_desc in r['issues']:
                print(f"  - [{issue_type}] {issue_desc}")

    # Save results
    with open("/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qg_audit_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\n" + "="*80)
    print(f"Results saved to: /Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/skill_qg_audit_results.json")
    print("="*80)

if __name__ == "__main__":
    main()
