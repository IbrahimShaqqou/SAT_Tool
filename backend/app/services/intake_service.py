"""
SAT Tutoring Platform - Intake Assessment Service

Implements Computerized Adaptive Testing (CAT) for intake assessments.
Selects questions adaptively to efficiently estimate student ability
across all domains and sections.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
import random

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.response import StudentResponse
from app.models.test import TestSession, TestQuestion
from app.models.enums import SubjectArea, DifficultyLevel, AnswerType
from app.services.irt_service import (
    probability_correct,
    item_information,
    estimate_ability_eap,
    DEFAULT_A,
    DEFAULT_B,
    DEFAULT_C_MCQ,
    DEFAULT_C_SPR,
    PRIOR_MEAN,
    PRIOR_SD,
)


# =============================================================================
# Intake Assessment Configuration
# =============================================================================

# Questions per domain for full intake
INTAKE_QUESTIONS_PER_DOMAIN = {
    "math_intake": 10,      # 10 per domain × 4 domains = 40 questions
    "rw_intake": 10,        # 10 per domain × 3 active domains = 30 questions
    "section": 5,           # 5 per domain for shorter assessments
    "domain": 10,           # 10 questions for single domain focus
    "quick": 3,             # 3 questions for quick check
}

# Difficulty distribution for intake (per domain)
# Spread from easy (-1.5) to hard (+1.5) to efficiently estimate ability
INTAKE_DIFFICULTY_DISTRIBUTION = {
    10: [
        (-1.5, "very-easy"), (-1.0, "easy"), (-0.5, "easy-medium"),
        (-0.25, "medium-easy"), (0.0, "medium"), (0.25, "medium"),
        (0.5, "medium-hard"), (0.75, "hard"), (1.0, "hard"), (1.5, "very-hard")
    ],
    5: [(-1.0, "easy"), (-0.25, "easy-medium"), (0.0, "medium"), (0.5, "medium-hard"), (1.0, "hard")],
    6: [(-1.0, "easy"), (-0.5, "easy-medium"), (0.0, "medium"), (0.5, "medium-hard"), (1.0, "hard"), (1.5, "very-hard")],
    3: [(-0.5, "easy"), (0.0, "medium"), (0.5, "hard")],
}


# =============================================================================
# CAT Question Selection for Intake
# =============================================================================

def get_domains_for_assessment(
    db: Session,
    subject_area: Optional[SubjectArea] = None
) -> List[Domain]:
    """Get domains to cover in the assessment."""
    query = db.query(Domain).filter(Domain.is_active == True)

    if subject_area:
        query = query.filter(Domain.subject_area == subject_area)

    return query.order_by(Domain.display_order).all()


def select_intake_questions(
    db: Session,
    question_count: int,
    subject_area: Optional[SubjectArea] = None,
    exclude_question_ids: set = None
) -> List[Question]:
    """
    Select questions for an intake assessment using skill-based stratified sampling.

    Key improvement: Ensures each skill gets questions at MULTIPLE difficulty levels
    (easy AND hard) to accurately estimate ability through IRT.

    This matters because:
    - Getting all easy questions right shouldn't give 100% mastery
    - We need questions at different difficulties to estimate theta accurately
    - Each skill needs its own difficulty spread, not just the domain

    Args:
        db: Database session
        question_count: Total questions to select
        subject_area: Must be specified (Math or Reading/Writing)
        exclude_question_ids: Questions to exclude (already seen)

    Returns:
        List of selected questions in recommended order
    """
    exclude_question_ids = exclude_question_ids or set()

    # Get domains for this assessment
    domains = get_domains_for_assessment(db, subject_area)

    if not domains:
        return []

    # Build skill-based question pools
    # Key: skill_id, Value: {skill, questions: [sorted by difficulty]}
    skill_pools = {}

    for domain in domains:
        skills = db.query(Skill).filter(Skill.domain_id == domain.id).all()

        for skill in skills:
            available = db.query(Question).filter(
                Question.skill_id == skill.id,
                Question.is_active == True,
                Question.deleted_at == None,
                ~Question.id.in_(exclude_question_ids) if exclude_question_ids else True
            ).all()

            if available:
                # Sort by difficulty (easy first)
                sorted_qs = sorted(
                    available,
                    key=lambda q: q.irt_difficulty_b or DEFAULT_B
                )
                skill_pools[skill.id] = {
                    "skill": skill,
                    "domain": domain,
                    "questions": sorted_qs
                }

    if not skill_pools:
        return []

    # Determine questions per skill
    # Goal: 2+ questions per skill with difficulty spread
    num_skills = len(skill_pools)
    questions_per_skill = max(2, question_count // num_skills)
    remainder = question_count % num_skills

    selected_questions = []
    used_ids = set()

    for i, (skill_id, pool) in enumerate(skill_pools.items()):
        questions = pool["questions"]
        target_count = questions_per_skill + (1 if i < remainder else 0)

        # Select questions with difficulty spread FOR THIS SKILL
        skill_selection = _select_skill_difficulty_spread(
            questions, target_count, used_ids
        )

        for q in skill_selection:
            used_ids.add(q.id)
            selected_questions.append(q)

    # Order questions: start with medium, alternate between easier and harder
    selected_questions = _order_questions_cat_style(selected_questions)

    return selected_questions


def _select_skill_difficulty_spread(
    questions: List[Question],
    count: int,
    exclude_ids: set = None
) -> List[Question]:
    """
    Select questions for a single skill with difficulty spread.

    Ensures at least one easy and one hard question per skill (when available).
    This is critical for accurate IRT ability estimation.

    Args:
        questions: List of questions sorted by difficulty (easy first)
        count: Number to select
        exclude_ids: Question IDs to skip

    Returns:
        Selected questions with difficulty variety
    """
    exclude_ids = exclude_ids or set()
    available = [q for q in questions if q.id not in exclude_ids]

    if not available:
        return []

    if len(available) <= count:
        return available

    # Strategy: Pick from easy, medium, and hard portions
    n = len(available)
    selected = []
    used_indices = set()

    # Define difficulty bands
    easy_end = n // 3
    hard_start = 2 * n // 3

    # First priority: one from easy portion
    if easy_end > 0:
        idx = 0
        selected.append(available[idx])
        used_indices.add(idx)

    # Second priority: one from hard portion
    if hard_start < n and len(selected) < count:
        idx = n - 1
        if idx not in used_indices:
            selected.append(available[idx])
            used_indices.add(idx)

    # Fill remaining from middle, then alternate
    if len(selected) < count:
        mid_start = n // 2
        # Try middle first
        for offset in range(n):
            if len(selected) >= count:
                break
            # Spiral outward from middle
            for direction in [1, -1]:
                idx = mid_start + (offset * direction)
                if 0 <= idx < n and idx not in used_indices:
                    selected.append(available[idx])
                    used_indices.add(idx)
                    if len(selected) >= count:
                        break

    return selected


def _select_with_difficulty_spread(
    questions: List[Question],
    count: int
) -> List[Question]:
    """
    Select questions ensuring a spread of difficulties.

    For intake assessments, we want to sample across the difficulty range
    to quickly estimate ability.
    """
    if len(questions) <= count:
        return questions

    # Get target difficulties based on count
    targets = INTAKE_DIFFICULTY_DISTRIBUTION.get(count, [])
    if not targets:
        # Fallback: even spread from -1 to +1
        targets = [(i / (count - 1) * 2 - 1, f"level_{i}") for i in range(count)]

    selected = []
    used_ids = set()

    for target_b, _ in targets:
        # Find question closest to target difficulty
        best_q = None
        best_distance = float('inf')

        for q in questions:
            if q.id in used_ids:
                continue

            q_b = q.irt_difficulty_b or DEFAULT_B
            distance = abs(q_b - target_b)

            if distance < best_distance:
                best_distance = distance
                best_q = q

        if best_q:
            selected.append(best_q)
            used_ids.add(best_q.id)

    # Fill remaining slots if needed
    while len(selected) < count and len(used_ids) < len(questions):
        for q in questions:
            if q.id not in used_ids:
                selected.append(q)
                used_ids.add(q.id)
                break

    return selected


def _order_questions_cat_style(questions: List[Question]) -> List[Question]:
    """
    Order questions in CAT style: start medium, branch based on difficulty.

    This ordering helps the adaptive algorithm converge faster:
    1. Start with medium difficulty questions
    2. Interleave easy and hard to cover the range
    3. Group by domain to maintain context
    """
    if not questions:
        return []

    # Sort by difficulty
    sorted_q = sorted(
        questions,
        key=lambda q: q.irt_difficulty_b or DEFAULT_B
    )

    # Find medium questions (middle third)
    n = len(sorted_q)
    medium_start = n // 3
    medium_end = 2 * n // 3

    medium = sorted_q[medium_start:medium_end]
    easy = sorted_q[:medium_start]
    hard = sorted_q[medium_end:]

    # Interleave: medium first, then alternate easy/hard
    result = []

    # Add medium questions first
    result.extend(medium)

    # Interleave easy and hard
    easy_idx, hard_idx = 0, 0
    use_easy = True

    while easy_idx < len(easy) or hard_idx < len(hard):
        if use_easy and easy_idx < len(easy):
            result.append(easy[easy_idx])
            easy_idx += 1
        elif hard_idx < len(hard):
            result.append(hard[hard_idx])
            hard_idx += 1
        elif easy_idx < len(easy):
            result.append(easy[easy_idx])
            easy_idx += 1
        use_easy = not use_easy

    return result


def select_next_cat_question(
    db: Session,
    session_id: UUID,
    current_theta: float = 0.0,
    answered_question_ids: set = None
) -> Optional[Question]:
    """
    Select the next question adaptively based on current ability estimate.

    Used during the assessment to adapt question difficulty based on
    student performance so far.

    Args:
        db: Database session
        session_id: Test session ID
        current_theta: Current ability estimate
        answered_question_ids: Questions already answered

    Returns:
        Next best question, or None if no more questions
    """
    answered_question_ids = answered_question_ids or set()

    # Get remaining questions in the session
    remaining = db.query(TestQuestion).join(
        Question, TestQuestion.question_id == Question.id
    ).filter(
        TestQuestion.test_session_id == session_id,
        TestQuestion.is_answered == False,
        ~TestQuestion.question_id.in_(answered_question_ids) if answered_question_ids else True
    ).all()

    if not remaining:
        return None

    # Score each question by information at current theta
    scored = []
    for tq in remaining:
        q = tq.question
        a = q.irt_discrimination_a or DEFAULT_A
        b = q.irt_difficulty_b or DEFAULT_B
        c = q.irt_guessing_c if q.irt_guessing_c is not None else (
            DEFAULT_C_MCQ if q.answer_type == AnswerType.MCQ else DEFAULT_C_SPR
        )

        info = item_information(current_theta, a, b, c)
        scored.append((tq, info))

    # Sort by information (highest first)
    scored.sort(key=lambda x: x[1], reverse=True)

    # Return the question with highest information
    # (with small randomization among top 3 for variety)
    top_n = min(3, len(scored))
    selected_idx = random.randint(0, top_n - 1)

    return scored[selected_idx][0].question


# =============================================================================
# Intake Results & Ability Estimation
# =============================================================================

def calculate_intake_results(
    db: Session,
    session_id: UUID
) -> Dict[str, Any]:
    """
    Calculate comprehensive results from an intake assessment.

    Generates per-domain ability estimates and predicted SAT scores.

    Args:
        db: Database session
        session_id: Completed test session ID

    Returns:
        Dict with domain abilities, section abilities, predicted scores,
        and recommendations
    """
    # Get all responses for this session
    responses = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session_id
    ).all()

    if not responses:
        return {"error": "No responses found"}

    # Group responses by domain
    domain_responses = {}
    for r in responses:
        q = db.query(Question).filter(Question.id == r.question_id).first()
        if q and q.domain_id:
            if q.domain_id not in domain_responses:
                domain_responses[q.domain_id] = []
            domain_responses[q.domain_id].append({
                "a": q.irt_discrimination_a or DEFAULT_A,
                "b": q.irt_difficulty_b or DEFAULT_B,
                "c": q.irt_guessing_c if q.irt_guessing_c is not None else DEFAULT_C_MCQ,
                "is_correct": r.is_correct,
                "question_id": q.id,
            })

    # Calculate ability for each domain
    domain_abilities = {}
    for domain_id, domain_resp in domain_responses.items():
        domain = db.query(Domain).filter(Domain.id == domain_id).first()
        theta, se = estimate_ability_eap(domain_resp)

        correct = sum(1 for r in domain_resp if r["is_correct"])
        total = len(domain_resp)

        domain_abilities[domain_id] = {
            "domain_id": domain_id,
            "domain_name": domain.name if domain else f"Domain {domain_id}",
            "domain_code": domain.code if domain else "",
            "section": domain.subject_area.value if domain and domain.subject_area else "",
            "theta": round(theta, 3),
            "se": round(se, 3),
            "correct": correct,
            "total": total,
            "accuracy": round(correct / total * 100, 1) if total > 0 else 0,
        }

    # Aggregate to section level
    section_abilities = {}
    for section in ["math", "reading_writing"]:
        section_domains = [
            d for d in domain_abilities.values()
            if d["section"] == section
        ]

        if section_domains:
            # Weighted average by response count
            total_weight = sum(d["total"] for d in section_domains)
            weighted_theta = sum(d["theta"] * d["total"] for d in section_domains)
            section_theta = weighted_theta / total_weight if total_weight > 0 else 0

            total_correct = sum(d["correct"] for d in section_domains)
            total_questions = sum(d["total"] for d in section_domains)

            # Predict SAT score (200-800 range)
            predicted_score = _theta_to_sat_score(section_theta)
            score_margin = 50  # Conservative margin

            section_abilities[section] = {
                "section": section,
                "theta": round(section_theta, 3),
                "correct": total_correct,
                "total": total_questions,
                "accuracy": round(total_correct / total_questions * 100, 1) if total_questions > 0 else 0,
                "predicted_score_low": max(200, predicted_score - score_margin),
                "predicted_score_mid": predicted_score,
                "predicted_score_high": min(800, predicted_score + score_margin),
            }

    # Calculate overall
    all_correct = sum(1 for r in responses if r.is_correct)
    all_total = len(responses)

    # Generate recommendations (weakest areas first)
    sorted_domains = sorted(
        domain_abilities.values(),
        key=lambda d: d["theta"]
    )

    priority_areas = []
    for d in sorted_domains[:3]:  # Top 3 weakest
        priority_areas.append({
            "domain_name": d["domain_name"],
            "current_level": _theta_to_level(d["theta"]),
            "recommendation": _get_recommendation(d["theta"], d["accuracy"]),
        })

    return {
        "overall": {
            "correct": all_correct,
            "total": all_total,
            "accuracy": round(all_correct / all_total * 100, 1) if all_total > 0 else 0,
        },
        "section_abilities": list(section_abilities.values()),
        "domain_abilities": list(domain_abilities.values()),
        "priority_areas": priority_areas,
        "predicted_composite": _calculate_composite_score(section_abilities),
    }


def _theta_to_sat_score(theta: float) -> int:
    """Convert theta to SAT score (200-800 scale)."""
    # Theta of 0 = 500, each theta unit = ~100 points
    score = 500 + (theta * 100)
    return max(200, min(800, int(round(score / 10) * 10)))


def _theta_to_level(theta: float) -> str:
    """Convert theta to descriptive level."""
    if theta >= 1.5:
        return "Advanced"
    elif theta >= 0.5:
        return "Proficient"
    elif theta >= -0.5:
        return "Developing"
    elif theta >= -1.5:
        return "Beginning"
    else:
        return "Foundational"


def _get_recommendation(theta: float, accuracy: float) -> str:
    """Get study recommendation based on performance."""
    if theta >= 1.0:
        return "Focus on challenging problems to push higher"
    elif theta >= 0.0:
        return "Practice medium-difficulty problems to solidify skills"
    elif accuracy < 50:
        return "Start with foundational concepts and build up"
    else:
        return "Review core concepts and practice systematically"


def _calculate_composite_score(section_abilities: Dict) -> Optional[Dict]:
    """Calculate predicted composite SAT score."""
    if not section_abilities:
        return None

    math = section_abilities.get("math", {})
    rw = section_abilities.get("reading_writing", {})

    if not math and not rw:
        return None

    math_mid = math.get("predicted_score_mid", 500)
    rw_mid = rw.get("predicted_score_mid", 500)

    composite_mid = math_mid + rw_mid

    return {
        "low": max(400, composite_mid - 100),
        "mid": composite_mid,
        "high": min(1600, composite_mid + 100),
    }


# =============================================================================
# Store Intake Results
# =============================================================================

def store_intake_abilities(
    db: Session,
    student_id: UUID,
    session_id: UUID
) -> Dict[str, Any]:
    """
    Store ability estimates from intake assessment to student profile.

    Creates/updates StudentSkill, StudentDomainAbility, and StudentSectionAbility
    records based on intake results.

    Args:
        db: Database session
        student_id: Student's UUID (may be None for guest)
        session_id: Completed intake session ID

    Returns:
        Summary of stored abilities
    """
    from app.models.response import StudentSkill
    from app.models.adaptive import StudentDomainAbility, StudentSectionAbility
    from app.services.irt_service import update_skill_ability, propagate_ability_updates

    if not student_id:
        # Guest assessment - can't store to profile
        return {"stored": False, "reason": "guest_assessment"}

    # Get intake results
    results = calculate_intake_results(db, session_id)

    if "error" in results:
        return {"stored": False, "reason": results["error"]}

    # Get responses grouped by skill
    responses = db.query(StudentResponse).filter(
        StudentResponse.test_session_id == session_id
    ).all()

    skill_responses = {}
    for r in responses:
        q = db.query(Question).filter(Question.id == r.question_id).first()
        if q and q.skill_id:
            if q.skill_id not in skill_responses:
                skill_responses[q.skill_id] = []
            skill_responses[q.skill_id].append({
                "a": q.irt_discrimination_a or DEFAULT_A,
                "b": q.irt_difficulty_b or DEFAULT_B,
                "c": q.irt_guessing_c if q.irt_guessing_c is not None else DEFAULT_C_MCQ,
                "is_correct": r.is_correct,
            })

    # Update skill abilities
    skills_updated = 0
    for skill_id, resp_list in skill_responses.items():
        update_skill_ability(db, student_id, skill_id, resp_list)
        propagate_ability_updates(db, student_id, skill_id)
        skills_updated += 1

    db.commit()

    return {
        "stored": True,
        "skills_updated": skills_updated,
        "domains_covered": len(results.get("domain_abilities", [])),
    }
