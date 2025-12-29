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
from app.models.adaptive import StudentAdaptiveSettings
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

# Default adaptive settings (generous for testing)
DEFAULT_REPETITION_TIME_DAYS = 7
DEFAULT_REPETITION_QUESTION_COUNT = 30
DEFAULT_CHALLENGE_BIAS = 0.5  # Increased from 0.3 for faster progression
DEFAULT_THETA_UPDATE_WEIGHT = 1.0

# Sliding window for ability estimation
ABILITY_ESTIMATION_WINDOW = 20  # Only use last N responses for estimation
MIN_THETA_FOR_HIGH_ACCURACY = 0.5  # Minimum theta if 80%+ accuracy in session

# "Test the water" exploration settings
EXPLORATION_PROBABILITY = 0.15  # 15% chance to try a harder question
EXPLORATION_DIFFICULTY_BOOST = 1.0  # How much harder (in theta units)

# Theta decay settings
DECAY_GRACE_PERIOD_DAYS = 14  # No decay within 14 days
DECAY_RATE_PER_WEEK = 0.05  # Theta decays 0.05 per week after grace period
STALE_SKILL_THRESHOLD_DAYS = 21  # Skills inactive 3+ weeks are "stale"


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
# Student Settings & Cross-Session Memory
# =============================================================================

def get_student_adaptive_settings(
    db: Session,
    student_id: UUID
) -> Dict[str, Any]:
    """
    Get student's adaptive learning settings (or defaults).

    Args:
        db: Database session
        student_id: Student's UUID

    Returns:
        Dict with settings: repetition_time_days, repetition_question_count,
        challenge_bias, theta_update_weight
    """
    settings = db.query(StudentAdaptiveSettings).filter(
        StudentAdaptiveSettings.student_id == student_id
    ).first()

    if settings:
        return {
            "repetition_time_days": settings.repetition_time_days,
            "repetition_question_count": settings.repetition_question_count,
            "challenge_bias": settings.challenge_bias,
            "theta_update_weight": settings.theta_update_weight,
        }

    # Return generous defaults for testing
    return {
        "repetition_time_days": DEFAULT_REPETITION_TIME_DAYS,
        "repetition_question_count": DEFAULT_REPETITION_QUESTION_COUNT,
        "challenge_bias": DEFAULT_CHALLENGE_BIAS,
        "theta_update_weight": DEFAULT_THETA_UPDATE_WEIGHT,
    }


def get_recently_seen_question_ids(
    db: Session,
    student_id: UUID,
    time_days: int = None,
    question_count: int = None
) -> set:
    """
    Get IDs of questions recently seen by the student (cross-session memory).

    A question is considered "recently seen" if it was answered within
    BOTH the time window AND the question count window.

    Args:
        db: Database session
        student_id: Student's UUID
        time_days: Don't repeat questions answered within X days
        question_count: Don't repeat until X other questions answered

    Returns:
        Set of question IDs to exclude
    """
    from datetime import datetime, timezone, timedelta

    # Get settings if not provided
    if time_days is None or question_count is None:
        settings = get_student_adaptive_settings(db, student_id)
        time_days = time_days or settings["repetition_time_days"]
        question_count = question_count or settings["repetition_question_count"]

    # Get recent responses ordered by time
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=time_days)

    recent_responses = db.query(StudentResponse).filter(
        StudentResponse.student_id == student_id,
        StudentResponse.created_at > cutoff_date
    ).order_by(StudentResponse.created_at.desc()).limit(question_count).all()

    # Questions seen within both windows are blocked
    # (must be in recent N AND within time window)
    blocked_ids = {r.question_id for r in recent_responses}

    return blocked_ids


def get_available_questions_with_memory(
    db: Session,
    student_id: UUID,
    skill_ids: List[int],
    exclude_session_ids: set = None
) -> Tuple[List[Question], Dict[str, Any]]:
    """
    Get available questions for adaptive selection with cross-session memory.

    Filters out questions the student has seen recently based on their
    adaptive settings (repetition window).

    Args:
        db: Database session
        student_id: Student's UUID
        skill_ids: List of skill IDs to include questions from
        exclude_session_ids: Additional question IDs to exclude (current session)

    Returns:
        Tuple of (available_questions, pool_health_info)
    """
    from app.models.taxonomy import Skill

    exclude_session_ids = exclude_session_ids or set()

    # Get all questions for the skills
    all_questions = db.query(Question).filter(
        Question.skill_id.in_(skill_ids),
        Question.is_active == True
    ).all()

    total_pool_size = len(all_questions)

    # Get recently seen question IDs (cross-session memory)
    recently_seen_ids = get_recently_seen_question_ids(db, student_id)

    # Combine with session exclusions
    all_excluded_ids = recently_seen_ids | exclude_session_ids

    # Filter to available questions
    available = [q for q in all_questions if q.id not in all_excluded_ids]

    # Calculate pool health info
    pool_health = {
        "total_questions": total_pool_size,
        "available_questions": len(available),
        "recently_seen": len(recently_seen_ids),
        "session_excluded": len(exclude_session_ids),
        "warning_level": None,
    }

    if len(available) == 0:
        pool_health["warning_level"] = "critical"
    elif len(available) < 5:
        pool_health["warning_level"] = "warning"
    elif len(available) < 10:
        pool_health["warning_level"] = "info"

    return available, pool_health


def get_session_aggressiveness_weight(session_length: int) -> float:
    """
    Calculate theta update weight based on session length.

    Shorter sessions need more aggressive updates to be responsive.
    Longer sessions should be more conservative for stability.

    Args:
        session_length: Total questions in the session

    Returns:
        Weight multiplier for theta updates (0.8 to 1.5)
    """
    if session_length <= 5:
        return 1.5  # Very aggressive for short sessions
    elif session_length <= 10:
        return 1.2  # Aggressive
    elif session_length <= 20:
        return 1.0  # Normal
    else:
        return 0.8  # Conservative for long sessions


# =============================================================================
# Adaptive Question Selection
# =============================================================================

def select_adaptive_question(
    theta: float,
    available_questions: List[Question],
    answered_ids: Optional[set] = None,
    randomize_top_n: int = 3,
    challenge_bias: float = 0.3,
    session_progress: float = 0.0,
    explore_hard: bool = None
) -> Optional[Question]:
    """
    Select the most informative question for the student's ability level.

    Uses maximum information criterion with progressive challenge: selects
    questions that provide good information while increasingly favoring
    harder questions as the session progresses.

    Includes "test the water" exploration: occasionally selects a harder
    question to probe the student's true ability ceiling.

    Args:
        theta: Student's current ability estimate
        available_questions: Pool of questions to choose from
        answered_ids: Set of question IDs already answered (to exclude)
        randomize_top_n: Randomly select from top N most informative
        challenge_bias: Base bonus weight for questions harder than theta (0-1)
        session_progress: How far through the session (0.0 to 1.0)
            Used for progressive challenge - increases difficulty target over time
        explore_hard: Force exploration mode (None = random based on probability)

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

    # "Test the water" exploration: occasionally try a harder question
    # This helps discover if the student can handle higher difficulty
    if explore_hard is None:
        explore_hard = random.random() < EXPLORATION_PROBABILITY

    if explore_hard:
        # Target significantly above current theta
        target_theta = theta + EXPLORATION_DIFFICULTY_BOOST
        effective_challenge_bias = 1.0  # Strong preference for harder
    else:
        # Progressive challenge: increase target difficulty as session progresses
        # Early session: target at theta
        # Late session: target slightly above theta
        progressive_offset = challenge_bias * session_progress * 0.5  # Max +0.25 at end
        target_theta = theta + progressive_offset
        # Effective challenge bias also increases with progress
        effective_challenge_bias = challenge_bias * (1 + session_progress * 0.5)

    # Calculate information for each candidate with progressive challenge
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
            difficulty_bonus = min(0.5, (b - theta) * effective_challenge_bias)
            info *= (1 + difficulty_bonus)

        # Slight penalty for questions too far from target (either direction)
        distance_from_target = abs(b - target_theta)
        distance_penalty = max(0, 1 - distance_from_target * 0.1)
        info *= distance_penalty

        question_scores.append((q, info, b))

    # Sort by adjusted information score (descending)
    question_scores.sort(key=lambda x: x[1], reverse=True)

    # Select from top N (with preference for difficulty diversity)
    top_candidates = question_scores[:min(randomize_top_n * 2, len(question_scores))]

    if len(top_candidates) == 1:
        return top_candidates[0][0]

    # ENFORCE difficulty diversity: spread across different b values
    # Round to 0.5 increments to get broader buckets
    seen_difficulties = set()
    diverse_candidates = []

    # First pass: one from each difficulty bucket
    for q, score, b in top_candidates:
        b_bucket = round(b * 2) / 2  # Round to 0.5 increments
        if b_bucket not in seen_difficulties:
            diverse_candidates.append((q, score))
            seen_difficulties.add(b_bucket)
        if len(diverse_candidates) >= randomize_top_n:
            break

    # Second pass: fill remaining slots if needed
    if len(diverse_candidates) < randomize_top_n:
        for q, score, b in top_candidates:
            already_added = any(dq.id == q.id for dq, _ in diverse_candidates)
            if not already_added and len(diverse_candidates) < randomize_top_n:
                diverse_candidates.append((q, score))

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


def select_adaptive_question_with_memory(
    db: Session,
    student_id: UUID,
    theta: float,
    skill_ids: List[int],
    session_answered_ids: set = None,
    session_questions_answered: int = 0,
    session_total_questions: int = 10
) -> Tuple[Optional[Question], Dict[str, Any]]:
    """
    Select adaptive question with full cross-session memory and progressive challenge.

    This is the main entry point for adaptive question selection, combining:
    - Cross-session question memory (no repeats)
    - Student's custom settings (repetition window, challenge bias)
    - Progressive challenge (harder questions as session progresses)
    - Pool health reporting

    Args:
        db: Database session
        student_id: Student's UUID
        theta: Student's current ability estimate
        skill_ids: List of skill IDs to select from
        session_answered_ids: Question IDs already answered in THIS session
        session_questions_answered: How many questions answered so far
        session_total_questions: Total questions in session

    Returns:
        Tuple of (selected_question, pool_health_info)
    """
    session_answered_ids = session_answered_ids or set()

    # Get student's settings
    settings = get_student_adaptive_settings(db, student_id)
    challenge_bias = settings["challenge_bias"]

    # Get available questions with cross-session memory
    available, pool_health = get_available_questions_with_memory(
        db, student_id, skill_ids, session_answered_ids
    )

    if not available:
        return None, pool_health

    # Calculate session progress for progressive challenge
    if session_total_questions > 0:
        session_progress = session_questions_answered / session_total_questions
    else:
        session_progress = 0.0

    # Select question with progressive challenge
    selected = select_adaptive_question(
        theta=theta,
        available_questions=available,
        answered_ids=session_answered_ids,  # Already filtered, but safety
        challenge_bias=challenge_bias,
        session_progress=session_progress
    )

    return selected, pool_health


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
    responses: List[Dict[str, Any]],
    session_length: int = None,
    session_correct: int = None,
    session_total: int = None
) -> Tuple[float, float]:
    """
    Update student's ability estimate for a skill based on responses.

    Uses sliding window (last N responses) for more responsive estimates,
    and applies session accuracy floor for high performers.

    Args:
        db: Database session
        student_id: Student's UUID
        skill_id: Skill ID
        responses: List of response data with IRT parameters
            Each response has: {"a", "b", "c", "is_correct"}
        session_length: Total questions in session (for aggressiveness weighting)
        session_correct: Number correct in current session (for accuracy floor)
        session_total: Number answered in current session (for accuracy floor)

    Returns:
        Tuple of (new_theta, new_se)
    """
    from datetime import datetime, timezone

    # Use sliding window: only last N responses for estimation
    # This makes the system more responsive to recent performance
    if len(responses) > ABILITY_ESTIMATION_WINDOW:
        estimation_responses = responses[-ABILITY_ESTIMATION_WINDOW:]
    else:
        estimation_responses = responses

    # Estimate new ability using EAP on windowed responses
    raw_theta, raw_se = estimate_ability_eap(estimation_responses)

    # Get previous theta for weighted update
    skill_record = db.query(StudentSkill).filter(
        StudentSkill.student_id == student_id,
        StudentSkill.skill_id == skill_id
    ).first()

    previous_theta = skill_record.ability_theta if skill_record else PRIOR_MEAN

    # Apply session-length aggressiveness
    if session_length:
        weight = get_session_aggressiveness_weight(session_length)

        # Also get student's custom weight if set
        settings = get_student_adaptive_settings(db, student_id)
        custom_weight = settings.get("theta_update_weight", 1.0)
        weight *= custom_weight

        # Weighted update: blend previous theta with new estimate
        # Higher weight = more influence from new estimate
        theta_change = raw_theta - previous_theta
        theta = previous_theta + (theta_change * min(weight, 2.0))

        # Adjust SE based on weight (more aggressive = more confident)
        se = raw_se / max(weight, 0.5)
    else:
        theta = raw_theta
        se = raw_se

    # Apply session accuracy floor: if doing very well, theta shouldn't be negative
    if session_correct is not None and session_total is not None and session_total >= 5:
        session_accuracy = session_correct / session_total
        if session_accuracy >= 0.8 and theta < MIN_THETA_FOR_HIGH_ACCURACY:
            # Boost theta toward minimum for high accuracy
            theta = max(theta, MIN_THETA_FOR_HIGH_ACCURACY * session_accuracy)
        elif session_accuracy >= 0.9 and theta < 1.0:
            # Even higher floor for 90%+ accuracy
            theta = max(theta, 0.8)

    # Count correct responses from the full list (for mastery tracking)
    total_responses = len(responses)
    correct_responses = sum(1 for r in responses if r.get("is_correct", False))

    # Get or create StudentSkill record
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

    # Update mastery level - IRT-based calculation that accounts for difficulty
    #
    # Key insight: Theta already incorporates question difficulty through IRT.
    # Getting 100% on easy questions gives a lower theta than 100% on hard questions.
    # Therefore, theta should be the PRIMARY driver of mastery, not raw accuracy.
    #
    # This ensures getting all easy questions right doesn't give 100% mastery.
    # To achieve high mastery, students must demonstrate ability on harder questions.

    if total_responses > 0:
        accuracy = (correct_responses / total_responses) * 100
    else:
        accuracy = 0.0

    # Convert theta to base mastery percentage
    # theta -2 → ~20%, theta 0 → 50%, theta +2 → ~80%
    # This gives room for growth - need theta ~2.5+ for 90%+ mastery
    theta_mastery = 50 + (theta * 17.5)

    # Calculate average difficulty of questions answered
    # This caps mastery based on the difficulty level tested
    avg_difficulty = sum(r.get("b", 0) for r in responses) / len(responses) if responses else 0

    # Difficulty cap: can't achieve very high mastery if only answering easy questions
    # avg_difficulty -1.5 (very easy) → cap at 55%
    # avg_difficulty 0 (medium) → cap at 75%
    # avg_difficulty +1.5 (very hard) → cap at 95%
    difficulty_cap = 75 + (avg_difficulty * 13.3)
    difficulty_cap = max(40, min(95, difficulty_cap))

    # Apply theta estimate capped by difficulty range tested
    mastery = min(theta_mastery, difficulty_cap)

    # Accuracy floor: if you got most questions right, ensure minimum mastery
    # This prevents unfairly low mastery when theta estimation has high variance
    if accuracy >= 90:
        mastery = max(mastery, 40)  # At least 40% for 90%+ accuracy
    elif accuracy >= 75:
        mastery = max(mastery, 30)  # At least 30% for 75%+ accuracy

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


# =============================================================================
# Theta Decay & Stale Skills
# =============================================================================

def calculate_decayed_theta(
    theta: float,
    last_practiced_at,
    grace_period_days: int = DECAY_GRACE_PERIOD_DAYS,
    decay_rate_per_week: float = DECAY_RATE_PER_WEEK
) -> float:
    """
    Calculate decayed theta based on time since last practice.

    Skills that haven't been practiced in a while decay toward 0 (prior mean).
    This encourages spaced repetition and review of older material.

    Args:
        theta: Current ability estimate
        last_practiced_at: Datetime of last practice (or None)
        grace_period_days: No decay within this many days
        decay_rate_per_week: How much theta decays per week after grace period

    Returns:
        Decayed theta value
    """
    from datetime import datetime, timezone

    if last_practiced_at is None:
        return theta

    # Calculate days since last practice
    now = datetime.now(timezone.utc)
    if last_practiced_at.tzinfo is None:
        # Assume UTC if no timezone
        from datetime import timezone as tz
        last_practiced_at = last_practiced_at.replace(tzinfo=tz.utc)

    days_since = (now - last_practiced_at).days

    # No decay within grace period
    if days_since <= grace_period_days:
        return theta

    # Calculate decay
    days_past_grace = days_since - grace_period_days
    weeks_past_grace = days_past_grace / 7.0

    # Decay toward prior mean (0)
    # Use exponential decay: theta_decayed = theta * decay_factor + prior * (1 - decay_factor)
    decay_amount = decay_rate_per_week * weeks_past_grace
    decay_factor = max(0.0, 1.0 - decay_amount)  # Cap at full decay

    # Decay toward 0 (prior mean)
    decayed_theta = theta * decay_factor

    return decayed_theta


def get_stale_skills(
    db: Session,
    student_id: UUID,
    threshold_days: int = STALE_SKILL_THRESHOLD_DAYS
) -> List[Dict[str, Any]]:
    """
    Get skills that haven't been practiced in a while and need review.

    Useful for tutors to identify areas that need attention.

    Args:
        db: Database session
        student_id: Student's UUID
        threshold_days: Skills inactive for this many days are "stale"

    Returns:
        List of stale skill info: [{skill_id, skill_name, days_since, decayed_theta, original_theta}]
    """
    from datetime import datetime, timezone, timedelta
    from app.models.taxonomy import Skill

    cutoff = datetime.now(timezone.utc) - timedelta(days=threshold_days)

    # Get skills with old last_practiced_at
    stale_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == student_id,
        StudentSkill.last_practiced_at < cutoff,
        StudentSkill.responses_for_estimate > 0  # Only skills with some history
    ).all()

    stale_skills = []
    for record in stale_records:
        # Get skill name
        skill = db.query(Skill).filter(Skill.id == record.skill_id).first()
        skill_name = skill.name if skill else f"Skill {record.skill_id}"

        # Calculate days since practice
        days_since = (datetime.now(timezone.utc) - record.last_practiced_at).days

        # Calculate decayed theta
        decayed = calculate_decayed_theta(
            record.ability_theta or 0.0,
            record.last_practiced_at
        )

        stale_skills.append({
            "skill_id": record.skill_id,
            "skill_name": skill_name,
            "days_since_practice": days_since,
            "original_theta": record.ability_theta or 0.0,
            "decayed_theta": decayed,
            "responses_count": record.responses_for_estimate or 0,
            "mastery_level": record.mastery_level or 0.0,
        })

    # Sort by days since practice (most stale first)
    stale_skills.sort(key=lambda x: x["days_since_practice"], reverse=True)

    return stale_skills


# =============================================================================
# Hierarchical Ability Propagation (Skill → Domain → Section)
# =============================================================================

def update_domain_ability(
    db: Session,
    student_id: UUID,
    domain_id: int
) -> Tuple[float, float]:
    """
    Update domain-level ability by aggregating skill abilities.

    Domain theta is a weighted average of skill thetas within that domain,
    weighted by the number of responses per skill.

    Args:
        db: Database session
        student_id: Student's UUID
        domain_id: Domain ID to update

    Returns:
        Tuple of (domain_theta, domain_se)
    """
    from app.models.adaptive import StudentDomainAbility
    from app.models.taxonomy import Skill

    # Get all skills in this domain
    domain_skill_ids = db.query(Skill.id).filter(Skill.domain_id == domain_id).all()
    domain_skill_ids = [s[0] for s in domain_skill_ids]

    if not domain_skill_ids:
        return PRIOR_MEAN, PRIOR_SD

    # Get student's skill records for this domain
    skill_records = db.query(StudentSkill).filter(
        StudentSkill.student_id == student_id,
        StudentSkill.skill_id.in_(domain_skill_ids),
        StudentSkill.ability_theta.isnot(None)
    ).all()

    if not skill_records:
        return PRIOR_MEAN, PRIOR_SD

    # Calculate weighted average (weighted by response count)
    total_weight = 0
    weighted_theta = 0.0
    weighted_variance = 0.0
    total_responses = 0

    for record in skill_records:
        weight = max(1, record.responses_for_estimate or 1)
        theta = record.ability_theta or 0.0
        se = record.ability_se or PRIOR_SD

        # Apply decay if skill is stale
        if record.last_practiced_at:
            theta = calculate_decayed_theta(theta, record.last_practiced_at)

        total_weight += weight
        weighted_theta += weight * theta
        weighted_variance += weight * (se ** 2)
        total_responses += record.responses_for_estimate or 0

    domain_theta = weighted_theta / total_weight if total_weight > 0 else PRIOR_MEAN
    domain_se = math.sqrt(weighted_variance / total_weight) if total_weight > 0 else PRIOR_SD

    # Get or create domain ability record
    domain_record = db.query(StudentDomainAbility).filter(
        StudentDomainAbility.student_id == student_id,
        StudentDomainAbility.domain_id == domain_id
    ).first()

    if not domain_record:
        import uuid
        domain_record = StudentDomainAbility(
            id=uuid.uuid4(),
            student_id=student_id,
            domain_id=domain_id
        )
        db.add(domain_record)

    domain_record.ability_theta = domain_theta
    domain_record.ability_se = domain_se
    domain_record.responses_count = total_responses

    from datetime import datetime, timezone
    domain_record.last_updated = datetime.now(timezone.utc)

    db.flush()

    return domain_theta, domain_se


def update_section_ability(
    db: Session,
    student_id: UUID,
    section: str
) -> Tuple[float, float, Optional[int], Optional[int]]:
    """
    Update section-level ability by aggregating domain abilities.

    Section theta is a weighted average of domain thetas within that section.
    Also calculates predicted SAT score range.

    Args:
        db: Database session
        student_id: Student's UUID
        section: "math" or "reading_writing"

    Returns:
        Tuple of (section_theta, section_se, predicted_score_low, predicted_score_high)
    """
    from app.models.adaptive import StudentDomainAbility, StudentSectionAbility
    from app.models.taxonomy import Domain
    from app.models.enums import SubjectArea

    # Get domains for this section (section is "math" or "reading_writing")
    try:
        subject_area = SubjectArea(section)
    except ValueError:
        return PRIOR_MEAN, PRIOR_SD, None, None

    section_domains = db.query(Domain).filter(Domain.subject_area == subject_area).all()
    domain_ids = [d.id for d in section_domains]

    if not domain_ids:
        return PRIOR_MEAN, PRIOR_SD, None, None

    # Get student's domain abilities
    domain_records = db.query(StudentDomainAbility).filter(
        StudentDomainAbility.student_id == student_id,
        StudentDomainAbility.domain_id.in_(domain_ids)
    ).all()

    if not domain_records:
        return PRIOR_MEAN, PRIOR_SD, None, None

    # Calculate weighted average
    total_weight = 0
    weighted_theta = 0.0
    weighted_variance = 0.0
    total_responses = 0

    for record in domain_records:
        weight = max(1, record.responses_count or 1)

        total_weight += weight
        weighted_theta += weight * (record.ability_theta or 0.0)
        weighted_variance += weight * ((record.ability_se or PRIOR_SD) ** 2)
        total_responses += record.responses_count or 0

    section_theta = weighted_theta / total_weight if total_weight > 0 else PRIOR_MEAN
    section_se = math.sqrt(weighted_variance / total_weight) if total_weight > 0 else PRIOR_SD

    # Convert theta to predicted SAT score (200-800 scale)
    # Theta of 0 ≈ average score (500)
    # Theta of ±3 ≈ min/max scores (200/800)
    base_score = 500
    score_per_theta = 100  # Each theta unit = ~100 points

    predicted_score_mid = base_score + (section_theta * score_per_theta)
    score_margin = section_se * score_per_theta * 1.5  # 1.5 SE margin

    predicted_score_low = max(200, int(predicted_score_mid - score_margin))
    predicted_score_high = min(800, int(predicted_score_mid + score_margin))

    # Get or create section ability record
    section_record = db.query(StudentSectionAbility).filter(
        StudentSectionAbility.student_id == student_id,
        StudentSectionAbility.section == section
    ).first()

    if not section_record:
        import uuid
        section_record = StudentSectionAbility(
            id=uuid.uuid4(),
            student_id=student_id,
            section=section
        )
        db.add(section_record)

    section_record.ability_theta = section_theta
    section_record.ability_se = section_se
    section_record.responses_count = total_responses
    section_record.predicted_score_low = predicted_score_low
    section_record.predicted_score_high = predicted_score_high

    from datetime import datetime, timezone
    section_record.last_updated = datetime.now(timezone.utc)

    db.flush()

    return section_theta, section_se, predicted_score_low, predicted_score_high


def propagate_ability_updates(
    db: Session,
    student_id: UUID,
    skill_id: int
) -> Dict[str, Any]:
    """
    Propagate skill ability update up the hierarchy.

    When a skill theta is updated, this function updates:
    1. The domain that contains the skill
    2. The section that contains the domain

    Args:
        db: Database session
        student_id: Student's UUID
        skill_id: The skill that was just updated

    Returns:
        Dict with updated domain and section info
    """
    from app.models.taxonomy import Skill, Domain

    result = {
        "skill_id": skill_id,
        "domain_updated": False,
        "section_updated": False,
    }

    # Get the skill's domain
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill or not skill.domain_id:
        return result

    # Update domain ability
    domain_theta, domain_se = update_domain_ability(db, student_id, skill.domain_id)
    result["domain_id"] = skill.domain_id
    result["domain_theta"] = domain_theta
    result["domain_se"] = domain_se
    result["domain_updated"] = True

    # Get the domain's section (subject_area)
    domain = db.query(Domain).filter(Domain.id == skill.domain_id).first()
    if not domain or not domain.subject_area:
        return result

    # Update section ability (subject_area is the section: math or reading_writing)
    section = domain.subject_area.value if hasattr(domain.subject_area, 'value') else str(domain.subject_area)
    section_theta, section_se, score_low, score_high = update_section_ability(
        db, student_id, section
    )
    result["section"] = section
    result["section_theta"] = section_theta
    result["section_se"] = section_se
    result["predicted_score_low"] = score_low
    result["predicted_score_high"] = score_high
    result["section_updated"] = True

    return result
