"""
SAT Tutoring Platform - Question Import Service

Bulk import questions from College Board fetch scripts.
Handles: data/math_norm.json and data/reading_norm.json
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import json
import uuid

from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.enums import AnswerType, DifficultyLevel, SubjectArea


# Mapping of CB difficulty to enum
DIFFICULTY_MAP: Dict[str, DifficultyLevel] = {
    "E": DifficultyLevel.EASY,
    "M": DifficultyLevel.MEDIUM,
    "H": DifficultyLevel.HARD,
}

# Default data directory (backend/data/)
DATA_DIR = Path(__file__).parent.parent.parent / "data"


def import_normalized_questions(
    db: Session,
    json_path: str,
    subject_area: SubjectArea,
    batch_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Import normalized questions from fetch script output.

    Args:
        db: Database session
        json_path: Path to math_norm.json or reading_norm.json
        subject_area: SubjectArea.MATH or SubjectArea.READING_WRITING
        batch_id: Optional batch identifier

    Returns:
        Dict with counts: {"imported": N, "skipped": N, "errors": N, "batch_id": str}
    """
    batch_id = batch_id or f"import_{datetime.now(timezone.utc).isoformat()}"

    with open(json_path, "r") as f:
        questions = json.load(f)

    # Pre-fetch domain and skill mappings
    domains = {d.code: d for d in db.query(Domain).all()}
    skills = {s.code: s for s in db.query(Skill).all()}

    # Track created skills
    skills_created = 0

    imported = 0
    skipped = 0
    errors = 0
    error_details: List[Dict[str, str]] = []

    for q_data in questions:
        try:
            external_id = str(q_data["uId"])

            # Check if already exists
            existing = db.query(Question).filter(
                Question.external_id == external_id
            ).first()

            if existing:
                skipped += 1
                continue

            meta = q_data.get("meta", {})

            # Map domain from metadata
            domain = None
            domain_code = _extract_domain_code(meta, subject_area)
            if domain_code:
                domain = domains.get(domain_code)

            # Map skill from skill_cd - create if doesn't exist
            skill = None
            skill_code = meta.get("skill_cd", "")
            skill_desc = meta.get("skill_desc", "")
            primary_class_desc = meta.get("primary_class_cd_desc", "")

            if skill_code:
                skill = skills.get(skill_code)
                if not skill and skill_desc and domain:
                    # Create the skill dynamically
                    skill = Skill(
                        code=skill_code,
                        name=skill_desc,
                        domain_id=domain.id,  # Link to domain directly
                        subdomain_id=None,  # No subdomain structure yet
                        primary_class_desc=primary_class_desc,
                    )
                    db.add(skill)
                    db.flush()  # Get the ID
                    skills[skill_code] = skill
                    skills_created += 1

            # Map difficulty
            difficulty = DIFFICULTY_MAP.get(meta.get("difficulty"))

            # Determine answer type
            answer_type_str = q_data.get("answer_type", "MCQ")
            answer_type = AnswerType(answer_type_str)

            # Build explanation - combine stimulus (passage) and rationale for reading
            explanation = q_data.get("rationale_html", "")
            stimulus = q_data.get("stimulus_html", "")

            # For reading questions, prepend the stimulus to the prompt if present
            prompt = q_data.get("prompt_html", "")
            if stimulus and subject_area == SubjectArea.READING_WRITING:
                prompt = f"{stimulus}\n\n{prompt}"

            # Build question record
            question = Question(
                id=uuid.uuid4(),
                external_id=external_id,
                ibn=meta.get("ibn"),
                subject_area=subject_area,
                domain_id=domain.id if domain else None,
                skill_id=skill.id if skill else None,
                answer_type=answer_type,
                difficulty=difficulty,
                score_band_range=meta.get("score_band_range_cd"),
                prompt_html=prompt,
                choices_json=q_data.get("choices_html") if answer_type == AnswerType.MCQ else None,
                correct_answer_json=q_data.get("correct", {}),
                explanation_html=explanation if explanation else None,
                raw_import_json=q_data,
                import_batch_id=batch_id,
                imported_at=datetime.now(timezone.utc),
            )

            db.add(question)
            imported += 1

            # Commit in batches of 100
            if imported % 100 == 0:
                db.commit()

        except Exception as e:
            errors += 1
            error_details.append({
                "uId": q_data.get("uId", "unknown"),
                "error": str(e)
            })

    # Final commit
    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
        "error_details": error_details[:10],  # First 10 errors
        "batch_id": batch_id,
        "total_processed": imported + skipped + errors,
        "skills_created": skills_created,
    }


def _extract_domain_code(meta: Dict[str, Any], subject_area: SubjectArea) -> Optional[str]:
    """
    Extract domain code from question metadata.

    For Math: Uses first character of skill_cd or maps from primary_class_cd_desc
    For Reading: Maps from primary_class_cd_desc or skill patterns
    """
    skill_cd = meta.get("skill_cd", "")
    primary_class = meta.get("primary_class_cd_desc", "").upper()

    if subject_area == SubjectArea.MATH:
        # Math domains: H (Algebra), P (Problem Solving), Q (Advanced Math), S (Additional)
        if skill_cd:
            first_char = skill_cd[0].upper()
            if first_char in ("H", "P", "Q", "S"):
                return first_char

        # Fallback to primary_class_cd_desc mapping
        if "ALGEBRA" in primary_class:
            return "H"
        elif "PROBLEM" in primary_class or "DATA" in primary_class:
            return "P"
        elif "ADVANCED" in primary_class or "PASSPORT" in primary_class:
            return "Q"
        elif "ADDITIONAL" in primary_class or "GEOMETRY" in primary_class:
            return "S"

    else:  # Reading/Writing
        # Reading domains: INI, CAS, EOI, SEC
        if "INFORMATION" in primary_class or "IDEAS" in primary_class:
            return "INI"
        elif "CRAFT" in primary_class or "STRUCTURE" in primary_class:
            return "CAS"
        elif "EXPRESSION" in primary_class:
            return "EOI"
        elif "ENGLISH" in primary_class or "CONVENTIONS" in primary_class:
            return "SEC"

    return None


def import_math_questions(
    db: Session,
    json_path: Optional[str] = None,
    batch_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Import math questions from math_norm.json.

    Args:
        db: Database session
        json_path: Path to math_norm.json (defaults to data/math_norm.json)
        batch_id: Optional batch identifier

    Returns:
        Import result dictionary
    """
    if json_path is None:
        json_path = str(DATA_DIR / "math_norm.json")

    return import_normalized_questions(
        db=db,
        json_path=json_path,
        subject_area=SubjectArea.MATH,
        batch_id=batch_id or f"math_import_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
    )


def import_reading_questions(
    db: Session,
    json_path: Optional[str] = None,
    batch_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Import reading questions from reading_norm.json.

    Args:
        db: Database session
        json_path: Path to reading_norm.json (defaults to data/reading_norm.json)
        batch_id: Optional batch identifier

    Returns:
        Import result dictionary
    """
    if json_path is None:
        json_path = str(DATA_DIR / "reading_norm.json")

    return import_normalized_questions(
        db=db,
        json_path=json_path,
        subject_area=SubjectArea.READING_WRITING,
        batch_id=batch_id or f"reading_import_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
    )


def seed_taxonomy(db: Session) -> Dict[str, int]:
    """
    Seed the database with initial domain taxonomy.

    Creates the standard SAT domains for Math and Reading/Writing.
    Subdomains and Skills should be populated during question import
    or from a separate taxonomy source.

    Returns:
        Dict with counts of created records
    """
    from app.models.taxonomy import Domain, Subdomain

    domains_created = 0

    # Math domains
    math_domains = [
        {"code": "H", "name": "Heart of Algebra", "display_order": 1},
        {"code": "P", "name": "Problem Solving and Data Analysis", "display_order": 2},
        {"code": "Q", "name": "Passport to Advanced Math", "display_order": 3},
        {"code": "S", "name": "Additional Topics in Math", "display_order": 4},
    ]

    for domain_data in math_domains:
        existing = db.query(Domain).filter(Domain.code == domain_data["code"]).first()
        if not existing:
            domain = Domain(
                code=domain_data["code"],
                name=domain_data["name"],
                subject_area=SubjectArea.MATH,
                display_order=domain_data["display_order"],
            )
            db.add(domain)
            domains_created += 1

    # Reading/Writing domains
    reading_domains = [
        {"code": "INI", "name": "Information and Ideas", "display_order": 1},
        {"code": "CAS", "name": "Craft and Structure", "display_order": 2},
        {"code": "EOI", "name": "Expression of Ideas", "display_order": 3},
        {"code": "SEC", "name": "Standard English Conventions", "display_order": 4},
    ]

    for domain_data in reading_domains:
        existing = db.query(Domain).filter(Domain.code == domain_data["code"]).first()
        if not existing:
            domain = Domain(
                code=domain_data["code"],
                name=domain_data["name"],
                subject_area=SubjectArea.READING_WRITING,
                display_order=domain_data["display_order"],
            )
            db.add(domain)
            domains_created += 1

    db.commit()

    return {
        "domains_created": domains_created,
    }
