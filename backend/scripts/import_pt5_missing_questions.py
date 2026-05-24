#!/usr/bin/env python3
"""
Import the 7 PT5 R/W questions that are not in the College Board public Q-bank
API but appear on mypractice.collegeboard.org. Parses the extracted HTML from
the practice_test_5_questions_*.json files and inserts them into the questions
table.

The 7 questions:
  Easy variant (Module 2 easier):
    Q37 - Average Clothing Prices table
  Hard variant (Module 2 harder):
    Q28 - Mary Engle Pennington
    Q30 - Despite the generalizations about human behavior
    Q35 - Efforts to automate classification of paintings
    Q44 - The Milkmaid by Vermeer
    Q45 - Physical materials transparent/translucent
    Q54 - Government classification of sensitive information

Usage:
    python3 scripts/import_pt5_missing_questions.py
    python3 scripts/import_pt5_missing_questions.py --dry-run    # parse only, no DB write
"""

import argparse
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent))

from bs4 import BeautifulSoup
from app.database import SessionLocal
from app.models.enums import AnswerType, DifficultyLevel, SubjectArea
from app.models.question import Question
from app.models.taxonomy import Domain, Skill


# Definitions of the missing PT5 questions to import
# We assign synthetic uIds (UUIDv4 namespace specific to PT5) so they can be
# referenced from the practice_test_modules mapping.
PT5_MISSING = [
    # Easy variant
    {
        "synthetic_uid": "pt5-easy-q37",
        "extracted_file": "practice_test_5_questions_easy.json",
        "question_number": 37,
        "label": "Average Clothing Prices",
        "domain_code": "INI",  # Information and Ideas (table-based)
        "skill_code": "COE",   # Command of Evidence
        "skill_name": "Command of Evidence",
        "primary_class_desc": "Information and Ideas",
        "score_band": 2,
        "difficulty": "E",
    },
    # Hard variant
    {
        "synthetic_uid": "pt5-hard-q28",
        "extracted_file": "practice_test_5_questions_hard.json",
        "question_number": 28,
        "label": "Mary Engle Pennington",
        "domain_code": "CAS",  # Craft and Structure
        "skill_code": "WIC",   # Words in Context
        "skill_name": "Words in Context",
        "primary_class_desc": "Craft and Structure",
        "score_band": 6,
        "difficulty": "H",
    },
    {
        "synthetic_uid": "pt5-hard-q30",
        "extracted_file": "practice_test_5_questions_hard.json",
        "question_number": 30,
        "label": "Behavioral psychology generalizations",
        "domain_code": "INI",
        "skill_code": "CID",
        "skill_name": "Central Ideas and Details",
        "primary_class_desc": "Information and Ideas",
        "score_band": 6,
        "difficulty": "H",
    },
    {
        "synthetic_uid": "pt5-hard-q35",
        "extracted_file": "practice_test_5_questions_hard.json",
        "question_number": 35,
        "label": "Automating classification of paintings (dual text)",
        "domain_code": "INI",
        "skill_code": "CTC",   # Cross-Text Connections
        "skill_name": "Cross-Text Connections",
        "primary_class_desc": "Information and Ideas",
        "score_band": 6,
        "difficulty": "H",
    },
    {
        "synthetic_uid": "pt5-hard-q44",
        "extracted_file": "practice_test_5_questions_hard.json",
        "question_number": 44,
        "label": "Vermeer's Milkmaid",
        "domain_code": "SEC",  # Standard English Conventions
        "skill_code": "FSS",   # Form, Structure, and Sense
        "skill_name": "Form, Structure, and Sense",
        "primary_class_desc": "Standard English Conventions",
        "score_band": 7,
        "difficulty": "H",
    },
    {
        "synthetic_uid": "pt5-hard-q45",
        "extracted_file": "practice_test_5_questions_hard.json",
        "question_number": 45,
        "label": "Transparent/translucent",
        "domain_code": "SEC",
        "skill_code": "BOU",   # Boundaries
        "skill_name": "Boundaries",
        "primary_class_desc": "Standard English Conventions",
        "score_band": 7,
        "difficulty": "H",
    },
    {
        "synthetic_uid": "pt5-hard-q54",
        "extracted_file": "practice_test_5_questions_hard.json",
        "question_number": 54,
        "label": "Government classification of sensitive info",
        "domain_code": "EOI",  # Expression of Ideas
        "skill_code": "SYN",   # Rhetorical Synthesis
        "skill_name": "Rhetorical Synthesis",
        "primary_class_desc": "Expression of Ideas",
        "score_band": 7,
        "difficulty": "H",
    },
]


def parse_question_html(html: str) -> Tuple[str, List[str], int, str]:
    """
    Parse an extracted question HTML into (prompt_html, choices_html, correct_index, raw_html).

    The extracted HTML structure is:
        <h3>Reading and Writing: Question N</h3>
        <div class="cb-margin-bottom-16">
            <p>...stimulus...</p>
            <table>...optional table...</table>
            ...
        </div>
        <div>
            <p>Which choice...?</p>
        </div>
        <ol type="A" class="answer-options">
            <li class=""><div><p>choice A</p></div></li>
            <li class="correct"><div class="correct"><p>choice B</p></div></li>
            ...
        </ol>
    """
    soup = BeautifulSoup(html, "html.parser")

    # Strip the heading
    h3 = soup.find("h3")
    if h3:
        h3.decompose()

    # Find the <ol> with answer options
    ol = soup.find("ol", class_="answer-options")
    choices_html: List[str] = []
    correct_index = -1
    if ol:
        for i, li in enumerate(ol.find_all("li", recursive=False)):
            inner = li.find("div")
            html_str = inner.decode_contents() if inner else li.decode_contents()
            choices_html.append(html_str.strip())
            classes = li.get("class", [])
            if "correct" in classes:
                correct_index = i
        ol.decompose()  # remove from prompt

    # The remaining soup body is the stimulus + question prompt
    prompt_html = "".join(str(c) for c in soup.children).strip()

    return prompt_html, choices_html, correct_index, html


def get_or_create_skill(db, skill_code: str, skill_name: str, domain: Domain) -> Optional[Skill]:
    skill = db.query(Skill).filter(Skill.code == skill_code).first()
    if skill:
        return skill
    skill = Skill(
        code=skill_code,
        name=skill_name,
        domain_id=domain.id if domain else None,
        is_active=True,
    )
    db.add(skill)
    db.flush()
    return skill


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Parse only, do not write to DB")
    args = parser.parse_args()

    data_dir = Path(__file__).parent.parent / "data"

    db = SessionLocal()
    try:
        # Pre-fetch domains keyed by code
        domains = {d.code: d for d in db.query(Domain).all()}
        print(f"Loaded {len(domains)} domains: {sorted(domains.keys())}")

        results = []
        for cfg in PT5_MISSING:
            extracted_path = data_dir / cfg["extracted_file"]
            with open(extracted_path) as f:
                extracted = json.load(f)

            extracted_q = next(
                (q for q in extracted if q["questionNumber"] == cfg["question_number"]),
                None,
            )
            if not extracted_q:
                print(f"  ✗ {cfg['synthetic_uid']}: not found in {cfg['extracted_file']}")
                continue

            prompt, choices, correct_idx, raw_html = parse_question_html(extracted_q["html"])

            print(f"\n=== {cfg['synthetic_uid']} ({cfg['label']}) ===")
            print(f"  Prompt preview ({len(prompt)} chars): {re.sub(r'<[^>]+>', ' ', prompt)[:120]}")
            print(f"  Choices: {len(choices)} (correct index = {correct_idx})")
            for i, c in enumerate(choices):
                marker = " ✓" if i == correct_idx else "  "
                print(f"   {marker} [{chr(65+i)}] {re.sub(r'<[^>]+>', ' ', c)[:80]}")

            if correct_idx < 0:
                print(f"  WARNING: no correct answer marked, skipping")
                continue

            if args.dry_run:
                results.append({"uid": cfg["synthetic_uid"], "ok": True, "skipped": True})
                continue

            # Already exists?
            existing = db.query(Question).filter(
                Question.external_id == cfg["synthetic_uid"]
            ).first()
            if existing:
                print(f"  Already exists in DB (id={existing.id}), skipping")
                results.append({"uid": cfg["synthetic_uid"], "ok": True, "skipped": True})
                continue

            domain = domains.get(cfg["domain_code"])
            if not domain:
                print(f"  WARNING: domain {cfg['domain_code']} not found, leaving null")
            skill = None
            if domain:
                skill = get_or_create_skill(db, cfg["skill_code"], cfg["skill_name"], domain)

            difficulty_map = {"E": DifficultyLevel.EASY, "M": DifficultyLevel.MEDIUM, "H": DifficultyLevel.HARD}

            q = Question(
                id=uuid.uuid4(),
                external_id=cfg["synthetic_uid"],
                ibn=None,
                subject_area=SubjectArea.READING_WRITING,
                domain_id=domain.id if domain else None,
                skill_id=skill.id if skill else None,
                answer_type=AnswerType.MCQ,
                difficulty=difficulty_map.get(cfg["difficulty"], DifficultyLevel.MEDIUM),
                score_band_range=str(cfg["score_band"]),
                prompt_html=prompt,
                choices_json=choices,
                correct_answer_json={"index": correct_idx},
                explanation_html=None,
                raw_import_json={
                    "source": "mypractice_pt5",
                    "synthetic": True,
                    "extracted_questionNumber": cfg["question_number"],
                    "extracted_text_preview": extracted_q["text"][:200],
                    "raw_html": raw_html,
                },
                import_batch_id="pt5_missing_manual_import",
                imported_at=datetime.now(timezone.utc),
                is_active=True,
            )
            db.add(q)
            db.flush()
            print(f"  Inserted Question id={q.id}")
            results.append({"uid": cfg["synthetic_uid"], "ok": True, "id": str(q.id)})

        if not args.dry_run:
            db.commit()
            print(f"\n✓ Committed {sum(1 for r in results if r.get('ok'))} questions")
        else:
            print("\n(dry run — no DB writes)")

        return results
    finally:
        db.close()


if __name__ == "__main__":
    main()
