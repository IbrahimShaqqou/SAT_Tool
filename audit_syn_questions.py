#!/usr/bin/env python3
"""
Visual audit script for Rhetorical Synthesis (SYN) questions.
Generates HTML files for each question and creates a report of issues found.
"""
import sys
sys.path.insert(0, '/Users/ibrahim/Desktop/SAT/SAT_Tool/backend')

from app.database import get_db
from app.models.question import Question
from app.models.taxonomy import Skill
import json
import os

def audit_syn_questions():
    """Audit all Rhetorical Synthesis questions"""
    db = next(get_db())

    # Get skill info
    skill = db.query(Skill).filter(Skill.id == 56).first()
    if not skill:
        print("Skill 56 (SYN) not found")
        return

    print(f"Auditing: {skill.name} (Code: {skill.code}, ID: {skill.id})")

    # Get all questions for this skill
    questions = db.query(Question).filter(
        Question.skill_id == 56,
        Question.is_active == True
    ).all()

    print(f"Total questions to audit: {len(questions)}")

    issues_found = []
    total_checked = 0

    # Create output directory
    output_dir = "/Users/ibrahim/Desktop/SAT/SAT_Tool/.playwright-mcp/syn_audit"
    os.makedirs(output_dir, exist_ok=True)

    # Audit each question
    for idx, question in enumerate(questions, 1):
        total_checked += 1
        question_issues = []

        # Check 1: Text rendering (prompt_html exists and has content)
        if not question.prompt_html or len(question.prompt_html.strip()) < 10:
            question_issues.append({
                "type": "missing content",
                "description": "Prompt HTML is missing or too short"
            })

        # Check 2: Answer choices exist for MCQ questions
        if question.answer_type == 'mcq':
            if not question.choices_json:
                question_issues.append({
                    "type": "missing content",
                    "description": "MCQ question has no answer choices"
                })
            else:
                try:
                    choices = json.loads(question.choices_json) if isinstance(question.choices_json, str) else question.choices_json
                    if not choices or len(choices) == 0:
                        question_issues.append({
                            "type": "missing content",
                            "description": "MCQ question has empty choices array"
                        })
                except:
                    question_issues.append({
                        "type": "missing content",
                        "description": "MCQ question has invalid choices JSON"
                    })

        # Check 3: Correct answer exists
        if not question.correct_answer_json:
            question_issues.append({
                "type": "missing content",
                "description": "No correct answer defined"
            })

        # Check 4: Check for common image issues (oversized image tags)
        if question.prompt_html and '<img' in question.prompt_html:
            if 'width' not in question.prompt_html.lower():
                question_issues.append({
                    "type": "oversized image",
                    "description": "Image tag without width constraint"
                })

        if question_issues:
            issues_found.append({
                "questionNum": idx,
                "questionId": str(question.id),
                "externalId": str(question.external_id),
                "issues": question_issues
            })

        # Generate HTML file for manual visual inspection
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>SYN Question {idx}/{len(questions)} - {question.external_id}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; max-width: 800px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .question {{ background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }}
        .choices {{ margin-top: 20px; }}
        .choice {{ padding: 10px; margin: 5px 0; border: 1px solid #ccc; border-radius: 4px; }}
        img {{ max-width: 100%; height: auto; }}
        .issues {{ background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>SYN Question {idx} of {len(questions)}</h1>
        <p><strong>Question ID:</strong> {question.external_id}</p>
        <p><strong>UID:</strong> {question.id}</p>
        <p><strong>Skill:</strong> Rhetorical Synthesis (SYN)</p>
    </div>

    <div class="question">
        <h2>Question</h2>
        {question.prompt_html or '<p>NO PROMPT HTML</p>'}

        {"<div class='choices'>" + "".join([f"<div class='choice'>{choice.get('text', 'NO TEXT')}</div>" for choice in (json.loads(question.choices_json) if question.choices_json else [])]) + "</div>" if question.answer_type == 'mcq' else ""}
    </div>

    {('<div class="issues"><h3>Issues Found:</h3><ul>' + "".join([f"<li>{i['type']}: {i['description']}</li>" for i in question_issues]) + '</ul></div>') if question_issues else ''}
</body>
</html>"""

        with open(f"{output_dir}/syn_{idx:03d}_{question.external_id[:8]}.html", "w") as f:
            f.write(html_content)

    # Generate summary report
    report = {
        "skill": {
            "id": skill.id,
            "code": skill.code,
            "name": skill.name,
            "domain": "Expression of Ideas"
        },
        "audit": {
            "timestamp": "2026-05-21T04:30:00Z",
            "totalQuestions": total_checked,
            "questionsWithIssues": len(issues_found),
            "issueCount": sum(len(q["issues"]) for q in issues_found)
        },
        "findings": issues_found
    }

    # Save report
    report_path = f"{output_dir}/syn_audit_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nAudit complete!")
    print(f"Total questions checked: {total_checked}")
    print(f"Questions with issues: {len(issues_found)}")
    print(f"Total issues: {report['audit']['issueCount']}")
    print(f"\nHTML files saved to: {output_dir}")
    print(f"Report saved to: {report_path}")

    return report

if __name__ == "__main__":
    audit_syn_questions()
