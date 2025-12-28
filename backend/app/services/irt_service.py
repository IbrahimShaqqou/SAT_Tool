"""
SAT Tutoring Platform - IRT (Item Response Theory) Service

Implements 3-Parameter Logistic (3PL) IRT model for:
- Student ability estimation
- Adaptive question selection
- Per-skill ability tracking
"""

import math
from typing import List, Tuple, Optional, Dict, Any
from uuid import UUID
import numpy as np
from scipy.stats import norm
from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.response import StudentResponse, StudentSkill
from app.models.enums import AnswerType


# =============================================================================
# Constants
# =============================================================================

# Theta grid for numerical integration (ability range)
THETA_MIN = -4.0
THETA_MAX = 4.0
THETA_POINTS = 81  # Grid resolution

# Prior distribution parameters (Normal)
PRIOR_MEAN = 0.0
PRIOR_SD = 1.0

# Default IRT parameters
DEFAULT_A = 1.0  # Default discrimination
DEFAULT_B = 0.0  # Default difficulty
DEFAULT_C_MCQ = 0.25  # Guessing for 4-choice MCQ
DEFAULT_C_SPR = 0.0  # No guessing for student-produced response


# =============================================================================
# 3PL IRT Core Functions
# =============================================================================

def probability_correct(theta: float, a: float, b: float, c: float) -> float:
    """
    Calculate probability of correct response using 3PL model.

    P(correct | theta, a, b, c) = c + (1-c) / (1 + exp(-a * (theta - b)))

    Args:
        theta: Student ability parameter (-3 to +3 typical range)
        a: Item discrimination parameter (0.5 to 2.5 typical)
        b: Item difficulty parameter (-3 to +3 typical range)
        c: Guessing parameter (0.25 for 4-choice MCQ, 0 for SPR)

    Returns:
        Probability of correct response (0 to 1)
    """
    # Prevent numerical overflow
    exponent = -a * (theta - b)
    exponent = max(min(exponent, 700), -700)  # Clamp to prevent overflow

    return c + (1 - c) / (1 + math.exp(exponent))


def probability_incorrect(theta: float, a: float, b: float, c: float) -> float:
    """Calculate probability of incorrect response (Q = 1 - P)."""
    return 1 - probability_correct(theta, a, b, c)


def item_information(theta: float, a: float, b: float, c: float) -> float:
    """
    Calculate Fisher information for an item at given ability level.

    Higher information = item is more informative at this ability level.
    Information is maximized when difficulty (b) matches ability (theta).

    Formula: I(theta) = a^2 * P * Q * ((P - c) / (1 - c))^2

    Args:
        theta: Student ability level
        a, b, c: Item parameters

    Returns:
        Information value (higher = more informative)
    """
    p = probability_correct(theta, a, b, c)
    q = 1 - p

    # Avoid division by zero
    if c >= 1:
        return 0.0

    # Calculate information
    numerator = (a ** 2) * q * ((p - c) ** 2)
    denominator = ((1 - c) ** 2) * p

    if denominator == 0:
        return 0.0

    return numerator / denominator


def calculate_test_information(theta: float, items: List[Dict[str, float]]) -> float:
    """
    Calculate total test information at given ability level.

    Args:
        theta: Student ability level
        items: List of item parameters [{"a": ..., "b": ..., "c": ...}, ...]

    Returns:
        Total information (sum of item informations)
    """
    return sum(
        item_information(theta, item["a"], item["b"], item["c"])
        for item in items
    )


# Note: This function was previously named 'test_information' but that caused
# pytest to try to run it as a test. Now renamed to calculate_test_information.


def standard_error(theta: float, items: List[Dict[str, float]]) -> float:
    """
    Calculate standard error of ability estimate.

    SE = 1 / sqrt(Information)

    Args:
        theta: Student ability level
        items: List of item parameters

    Returns:
        Standard error of the ability estimate
    """
    info = calculate_test_information(theta, items)
    if info <= 0:
        return float("inf")
    return 1 / math.sqrt(info)


# =============================================================================
# Ability Estimation
# =============================================================================

def _create_theta_grid() -> np.ndarray:
    """Create grid of theta values for numerical integration."""
    return np.linspace(THETA_MIN, THETA_MAX, THETA_POINTS)


def _prior_density(theta: np.ndarray) -> np.ndarray:
    """Calculate prior density (Normal distribution) at theta values."""
    return norm.pdf(theta, loc=PRIOR_MEAN, scale=PRIOR_SD)


def _likelihood(
    theta: np.ndarray,
    responses: List[Dict[str, Any]]
) -> np.ndarray:
    """
    Calculate likelihood of response pattern at each theta value.

    Args:
        theta: Array of theta values
        responses: List of {"a": float, "b": float, "c": float, "is_correct": bool}

    Returns:
        Array of likelihood values
    """
    likelihood = np.ones_like(theta)

    for resp in responses:
        a = resp.get("a", DEFAULT_A)
        b = resp.get("b", DEFAULT_B)
        c = resp.get("c", DEFAULT_C_MCQ)
        is_correct = resp["is_correct"]

        # Vectorized probability calculation
        exponent = -a * (theta - b)
        exponent = np.clip(exponent, -700, 700)
        p = c + (1 - c) / (1 + np.exp(exponent))

        if is_correct:
            likelihood *= p
        else:
            likelihood *= (1 - p)

    return likelihood


def estimate_ability_eap(
    responses: List[Dict[str, Any]]
) -> Tuple[float, float]:
    """
    Estimate ability using Expected A Posteriori (EAP) method.

    EAP is the mean of the posterior distribution, which is more stable
    than MLE especially with few responses.

    Args:
        responses: List of response data with item parameters and correctness
            [{"a": float, "b": float, "c": float, "is_correct": bool}, ...]

    Returns:
        Tuple of (theta_estimate, standard_error)
    """
    if not responses:
        return PRIOR_MEAN, PRIOR_SD

    # Create theta grid
    theta_grid = _create_theta_grid()
    delta = theta_grid[1] - theta_grid[0]  # Grid spacing

    # Calculate prior and likelihood
    prior = _prior_density(theta_grid)
    likelihood = _likelihood(theta_grid, responses)

    # Calculate posterior (unnormalized)
    posterior = prior * likelihood

    # Normalize posterior
    normalizing_constant = np.trapezoid(posterior, theta_grid)
    if normalizing_constant <= 0:
        # Fallback if numerical issues
        return PRIOR_MEAN, PRIOR_SD

    posterior = posterior / normalizing_constant

    # EAP estimate (mean of posterior)
    theta_eap = np.trapezoid(theta_grid * posterior, theta_grid)

    # Standard error (SD of posterior)
    variance = np.trapezoid((theta_grid - theta_eap) ** 2 * posterior, theta_grid)
    se = math.sqrt(max(variance, 0))

    return float(theta_eap), float(se)


def estimate_ability_mle(
    responses: List[Dict[str, Any]],
    max_iter: int = 50,
    tolerance: float = 0.001
) -> Tuple[float, float]:
    """
    Estimate ability using Maximum Likelihood Estimation (MLE).

    Uses Newton-Raphson iteration to find the theta that maximizes
    the likelihood of the observed response pattern.

    Args:
        responses: List of response data with item parameters
        max_iter: Maximum iterations for convergence
        tolerance: Convergence tolerance

    Returns:
        Tuple of (theta_estimate, standard_error)
    """
    if not responses:
        return PRIOR_MEAN, float("inf")

    # Check for perfect score patterns
    all_correct = all(r["is_correct"] for r in responses)
    all_incorrect = all(not r["is_correct"] for r in responses)

    if all_correct:
        return THETA_MAX - 0.5, 1.0  # High ability estimate
    if all_incorrect:
        return THETA_MIN + 0.5, 1.0  # Low ability estimate

    # Newton-Raphson iteration
    theta = 0.0  # Starting estimate

    for _ in range(max_iter):
        # Calculate first and second derivatives of log-likelihood
        d1 = 0.0  # First derivative
        d2 = 0.0  # Second derivative (negative)

        for resp in responses:
            a = resp.get("a", DEFAULT_A)
            b = resp.get("b", DEFAULT_B)
            c = resp.get("c", DEFAULT_C_MCQ)
            is_correct = resp["is_correct"]

            p = probability_correct(theta, a, b, c)
            q = 1 - p

            # Derivative components
            if c < 1:
                p_star = (p - c) / (1 - c)  # Probability from 2PL portion
            else:
                p_star = 0

            if is_correct:
                d1 += a * p_star * q / p if p > 0 else 0
            else:
                d1 -= a * p_star / q if q > 0 else 0

            # Information for second derivative
            d2 += item_information(theta, a, b, c)

        # Update theta
        if d2 > 0:
            delta = d1 / d2
            theta += delta

            # Bound theta
            theta = max(min(theta, THETA_MAX), THETA_MIN)

            if abs(delta) < tolerance:
                break

    # Calculate SE from information
    items = [{"a": r.get("a", DEFAULT_A),
              "b": r.get("b", DEFAULT_B),
              "c": r.get("c", DEFAULT_C_MCQ)} for r in responses]
    se = standard_error(theta, items)

    return theta, se


# =============================================================================
# Adaptive Question Selection
# =============================================================================

def select_adaptive_question(
    theta: float,
    available_questions: List[Question],
    answered_ids: Optional[set] = None,
    randomize_top_n: int = 3,
    challenge_bias: float = 0.3
) -> Optional[Question]:
    """
    Select the most informative question for the student's ability level.

    Uses maximum information criterion with a challenge bias: selects questions
    that provide good information while slightly favoring harder questions
    to challenge the student.

    Args:
        theta: Student's current ability estimate
        available_questions: Pool of questions to choose from
        answered_ids: Set of question IDs already answered (to exclude)
        randomize_top_n: Randomly select from top N most informative
        challenge_bias: Bonus weight for questions harder than theta (0-1)

    Returns:
        Selected question, or None if no questions available
    """
    import random

    if not available_questions:
        return None

    answered_ids = answered_ids or set()

    # Filter out already answered questions
    candidates = [q for q in available_questions if q.id not in answered_ids]

    if not candidates:
        return None

    # Calculate information for each candidate with challenge bias
    question_scores = []
    for q in candidates:
        a = q.irt_discrimination_a or DEFAULT_A
        b = q.irt_difficulty_b or DEFAULT_B
        c = q.irt_guessing_c if q.irt_guessing_c is not None else (
            DEFAULT_C_MCQ if q.answer_type == AnswerType.MCQ else DEFAULT_C_SPR
        )

        info = item_information(theta, a, b, c)

        # Add challenge bias: prefer questions slightly above theta
        # This helps progress students who are answering correctly
        if b > theta:
            # Bonus for harder questions, scaled by how much harder
            difficulty_bonus = min(0.5, (b - theta) * challenge_bias)
            info *= (1 + difficulty_bonus)

        question_scores.append((q, info, b))

    # Sort by adjusted information score (descending)
    question_scores.sort(key=lambda x: x[1], reverse=True)

    # Select from top N (with preference for difficulty diversity)
    top_candidates = question_scores[:min(randomize_top_n * 2, len(question_scores))]

    if len(top_candidates) == 1:
        return top_candidates[0][0]

    # Among top candidates, prefer questions at different difficulty levels
    # to avoid repetition at same difficulty
    seen_difficulties = set()
    diverse_candidates = []
    for q, score, b in top_candidates:
        b_rounded = round(b, 1)
        if b_rounded not in seen_difficulties or len(diverse_candidates) < randomize_top_n:
            diverse_candidates.append((q, score))
            seen_difficulties.add(b_rounded)
        if len(diverse_candidates) >= randomize_top_n:
            break

    if not diverse_candidates:
        diverse_candidates = [(q, score) for q, score, _ in top_candidates[:randomize_top_n]]

    # Random selection from diverse candidates (weighted by score)
    total_score = sum(score for _, score in diverse_candidates)
    if total_score == 0:
        return random.choice([q for q, _ in diverse_candidates])

    weights = [score / total_score for _, score in diverse_candidates]
    selected = random.choices(
        [q for q, _ in diverse_candidates],
        weights=weights,
        k=1
    )[0]

    return selected


def select_questions_for_test(
    theta: float,
    available_questions: List[Question],
    count: int,
    spread: float = 0.5
) -> List[Question]:
    """
    Select a set of questions for a test, targeting around student's ability.

    Unlike pure adaptive selection, this spreads questions across
    difficulty levels for better ability estimation.

    Args:
        theta: Student's ability estimate
        available_questions: Pool of questions
        count: Number of questions to select
        spread: How much to spread around theta (in SD units)

    Returns:
        List of selected questions
    """
    if not available_questions or count <= 0:
        return []

    # Target different difficulty levels
    target_difficulties = []
    for i in range(count):
        # Spread questions evenly from theta-spread to theta+spread
        if count > 1:
            offset = -spread + (2 * spread * i / (count - 1))
        else:
            offset = 0
        target_difficulties.append(theta + offset)

    selected = []
    used_ids = set()

    for target_b in target_difficulties:
        # Find question closest to target difficulty
        best_question = None
        best_distance = float("inf")

        for q in available_questions:
            if q.id in used_ids:
                continue

            b = q.irt_difficulty_b or DEFAULT_B
            distance = abs(b - target_b)

            if distance < best_distance:
                best_distance = distance
                best_question = q

        if best_question:
            selected.append(best_question)
            used_ids.add(best_question.id)

    return selected


# =============================================================================
# Per-Skill Ability Tracking
# =============================================================================

def get_skill_ability(
    db: Session,
    student_id: UUID,
    skill_id: int
) -> Tuple[float, float, int]:
    """
    Get student's current ability estimate for a specific skill.

    Args:
        db: Database session
        student_id: Student's UUID
        skill_id: Skill ID

    Returns:
        Tuple of (theta, standard_error, response_count)
    """
    skill_record = db.query(StudentSkill).filter(
        StudentSkill.student_id == student_id,
        StudentSkill.skill_id == skill_id
    ).first()

    if skill_record and skill_record.ability_theta is not None:
        return (
            skill_record.ability_theta,
            skill_record.ability_se or PRIOR_SD,
            skill_record.responses_for_estimate or 0
        )

    # Default for new skill
    return PRIOR_MEAN, PRIOR_SD, 0


def update_skill_ability(
    db: Session,
    student_id: UUID,
    skill_id: int,
    responses: List[Dict[str, Any]]
) -> Tuple[float, float]:
    """
    Update student's ability estimate for a skill based on responses.

    Args:
        db: Database session
        student_id: Student's UUID
        skill_id: Skill ID
        responses: List of response data with IRT parameters
            Each response has: {"a", "b", "c", "is_correct"}

    Returns:
        Tuple of (new_theta, new_se)
    """
    from datetime import datetime, timezone

    # Estimate new ability
    theta, se = estimate_ability_eap(responses)

    # Count correct responses from the list
    total_responses = len(responses)
    correct_responses = sum(1 for r in responses if r.get("is_correct", False))

    # Get or create StudentSkill record
    skill_record = db.query(StudentSkill).filter(
        StudentSkill.student_id == student_id,
        StudentSkill.skill_id == skill_id
    ).first()

    if not skill_record:
        skill_record = StudentSkill(
            student_id=student_id,
            skill_id=skill_id,
            mastery_level=0.0,
            questions_attempted=0,
            questions_correct=0
        )
        db.add(skill_record)

    # Update question counts
    skill_record.questions_attempted = total_responses
    skill_record.questions_correct = correct_responses

    # Update IRT fields
    skill_record.ability_theta = theta
    skill_record.ability_se = se
    skill_record.responses_for_estimate = total_responses
    skill_record.last_practiced_at = datetime.now(timezone.utc)

    # Update mastery level - combine accuracy with IRT ability
    # Base mastery on accuracy (what user expects to see)
    if total_responses > 0:
        accuracy = (correct_responses / total_responses) * 100
    else:
        accuracy = 0.0

    # Weight accuracy heavily, but adjust slightly by theta
    # This gives intuitive mastery (high accuracy = high mastery)
    # but also accounts for difficulty of questions answered
    theta_bonus = max(-10, min(10, theta * 5))  # -10 to +10 bonus from theta
    mastery = accuracy + theta_bonus
    mastery = max(0, min(100, mastery))
    skill_record.mastery_level = mastery

    db.flush()

    return theta, se


def calculate_overall_ability(
    db: Session,
    student_id: UUID
) -> Tuple[float, float]:
    """
    Calculate student's overall ability across all skills.

    Uses weighted average based on response counts per skill.

    Args:
        db: Database session
        student_id: Student's UUID

    Returns:
        Tuple of (overall_theta, overall_se)
    """
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == student_id,
        StudentSkill.ability_theta.isnot(None)
    ).all()

    if not skill_records:
        return PRIOR_MEAN, PRIOR_SD

    # Weighted average by response count
    total_weight = 0
    weighted_theta = 0
    weighted_variance = 0

    for record in skill_records:
        weight = record.responses_for_estimate or 1
        total_weight += weight
        weighted_theta += weight * record.ability_theta

        se = record.ability_se or PRIOR_SD
        weighted_variance += weight * (se ** 2)

    if total_weight == 0:
        return PRIOR_MEAN, PRIOR_SD

    overall_theta = weighted_theta / total_weight
    overall_se = math.sqrt(weighted_variance / total_weight)

    return overall_theta, overall_se


# =============================================================================
# Parameter Initialization Helpers
# =============================================================================

def score_band_to_difficulty(score_band: Optional[int]) -> float:
    """
    Convert College Board score_band_range to IRT difficulty (b).

    Score band 1-8 maps to difficulty -2.5 to +2.5

    Args:
        score_band: Score band value (1-8)

    Returns:
        IRT difficulty parameter (b)
    """
    if score_band is None:
        return DEFAULT_B

    # Linear mapping: 1 -> -2.5, 8 -> +2.5
    # Formula: b = (score_band - 4.5) * (5.0 / 7.0)
    return (score_band - 4.5) * (5.0 / 7.0)


def difficulty_level_to_discrimination(difficulty: Optional[str]) -> float:
    """
    Convert difficulty level (E/M/H) to IRT discrimination (a).

    Args:
        difficulty: Difficulty level string

    Returns:
        IRT discrimination parameter (a)
    """
    mapping = {
        "EASY": 0.8,
        "MEDIUM": 1.2,
        "HARD": 1.5,
        "E": 0.8,
        "M": 1.2,
        "H": 1.5,
    }

    if difficulty is None:
        return DEFAULT_A

    return mapping.get(difficulty.upper(), DEFAULT_A)


def get_guessing_parameter(answer_type: AnswerType) -> float:
    """
    Get guessing parameter based on answer type.

    Args:
        answer_type: MCQ or SPR

    Returns:
        Guessing parameter (c)
    """
    if answer_type == AnswerType.MCQ:
        return DEFAULT_C_MCQ
    return DEFAULT_C_SPR
