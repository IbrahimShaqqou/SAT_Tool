"""
SAT Tutoring Platform - IRT Calibration Service

Initializes and calibrates IRT parameters for questions.
"""

from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.question import Question
from app.models.enums import AnswerType, DifficultyLevel
from app.services.irt_service import (
    score_band_to_difficulty,
    difficulty_level_to_discrimination,
    get_guessing_parameter,
    DEFAULT_A,
    DEFAULT_B,
    DEFAULT_C_MCQ,
)


def initialize_question_irt_parameters(
    db: Session,
    question: Question
) -> Dict[str, float]:
    """
    Initialize IRT parameters for a single question based on metadata.

    Args:
        db: Database session
        question: Question to initialize

    Returns:
        Dict with initialized parameters {"a": ..., "b": ..., "c": ...}
    """
    # Determine difficulty (b) from score_band_range
    score_band = None
    if question.score_band_range:
        try:
            score_band = int(question.score_band_range)
        except (ValueError, TypeError):
            score_band = None

    b = score_band_to_difficulty(score_band)

    # Determine discrimination (a) from difficulty level
    difficulty_str = None
    if question.difficulty:
        difficulty_str = question.difficulty.value if hasattr(question.difficulty, 'value') else str(question.difficulty)

    a = difficulty_level_to_discrimination(difficulty_str)

    # Determine guessing (c) from answer type
    c = get_guessing_parameter(question.answer_type)

    # Update the question
    question.irt_difficulty_b = b
    question.irt_discrimination_a = a
    question.irt_guessing_c = c

    return {"a": a, "b": b, "c": c}


def initialize_all_question_parameters(
    db: Session,
    batch_size: int = 500
) -> Dict[str, int]:
    """
    Initialize IRT parameters for all questions in the database.

    Args:
        db: Database session
        batch_size: Number of questions to process per batch

    Returns:
        Dict with counts {"total": N, "updated": N, "skipped": N}
    """
    stats = {"total": 0, "updated": 0, "skipped": 0}

    # Process in batches
    offset = 0

    while True:
        questions = db.query(Question).filter(
            Question.is_active == True
        ).offset(offset).limit(batch_size).all()

        if not questions:
            break

        for question in questions:
            stats["total"] += 1

            # Skip if already has IRT parameters
            if (question.irt_difficulty_b is not None and
                question.irt_discrimination_a is not None and
                question.irt_guessing_c is not None):
                stats["skipped"] += 1
                continue

            initialize_question_irt_parameters(db, question)
            stats["updated"] += 1

        db.flush()
        offset += batch_size

    db.commit()
    return stats


def initialize_parameters_sql(db: Session) -> Dict[str, int]:
    """
    Initialize IRT parameters using raw SQL for better performance.

    This is faster than ORM for bulk updates.

    Args:
        db: Database session

    Returns:
        Dict with row counts for each update
    """
    results = {}

    # Initialize irt_difficulty_b from score_band_range
    # Formula: b = (score_band - 4.5) * (5.0 / 7.0)
    result = db.execute(text("""
        UPDATE questions
        SET irt_difficulty_b = (CAST(score_band_range AS FLOAT) - 4.5) * (5.0 / 7.0)
        WHERE score_band_range IS NOT NULL
        AND irt_difficulty_b IS NULL
    """))
    results["difficulty_from_scoreband"] = result.rowcount

    # Set default difficulty for questions without score_band
    result = db.execute(text(f"""
        UPDATE questions
        SET irt_difficulty_b = {DEFAULT_B}
        WHERE irt_difficulty_b IS NULL
    """))
    results["difficulty_default"] = result.rowcount

    # Initialize irt_discrimination_a from difficulty level
    # EASY -> 0.8, MEDIUM -> 1.2, HARD -> 1.5
    result = db.execute(text("""
        UPDATE questions
        SET irt_discrimination_a = 0.8
        WHERE difficulty = 'EASY'
        AND irt_discrimination_a IS NULL
    """))
    results["discrimination_easy"] = result.rowcount

    result = db.execute(text("""
        UPDATE questions
        SET irt_discrimination_a = 1.2
        WHERE difficulty = 'MEDIUM'
        AND irt_discrimination_a IS NULL
    """))
    results["discrimination_medium"] = result.rowcount

    result = db.execute(text("""
        UPDATE questions
        SET irt_discrimination_a = 1.5
        WHERE difficulty = 'HARD'
        AND irt_discrimination_a IS NULL
    """))
    results["discrimination_hard"] = result.rowcount

    # Set default discrimination for questions without difficulty
    result = db.execute(text(f"""
        UPDATE questions
        SET irt_discrimination_a = {DEFAULT_A}
        WHERE irt_discrimination_a IS NULL
    """))
    results["discrimination_default"] = result.rowcount

    # Initialize irt_guessing_c based on answer type
    result = db.execute(text(f"""
        UPDATE questions
        SET irt_guessing_c = {DEFAULT_C_MCQ}
        WHERE answer_type = 'MCQ'
        AND irt_guessing_c IS NULL
    """))
    results["guessing_mcq"] = result.rowcount

    result = db.execute(text("""
        UPDATE questions
        SET irt_guessing_c = 0.0
        WHERE answer_type = 'SPR'
        AND irt_guessing_c IS NULL
    """))
    results["guessing_spr"] = result.rowcount

    db.commit()

    return results


def recalibrate_from_responses(
    db: Session,
    min_responses: int = 100
) -> Dict[str, Any]:
    """
    Recalibrate IRT parameters based on actual student responses.

    This is a more sophisticated calibration that uses response data
    to refine parameter estimates. Requires sufficient response history.

    Note: This is a placeholder for future implementation.
    Full IRT calibration requires specialized algorithms like MMLE or EM.

    Args:
        db: Database session
        min_responses: Minimum responses needed for recalibration

    Returns:
        Calibration results
    """
    # TODO: Implement proper IRT calibration using response data
    # This would use algorithms like:
    # - Joint Maximum Likelihood Estimation (JMLE)
    # - Marginal Maximum Likelihood Estimation (MMLE)
    # - EM algorithm

    # For now, just return a placeholder
    return {
        "status": "not_implemented",
        "message": "Response-based calibration requires specialized algorithms. "
                   "Currently using initial estimates from metadata."
    }


def get_calibration_stats(db: Session) -> Dict[str, Any]:
    """
    Get statistics about IRT parameter coverage.

    Args:
        db: Database session

    Returns:
        Dict with coverage statistics
    """
    from sqlalchemy import func

    total = db.query(func.count(Question.id)).filter(
        Question.is_active == True
    ).scalar()

    with_b = db.query(func.count(Question.id)).filter(
        Question.is_active == True,
        Question.irt_difficulty_b.isnot(None)
    ).scalar()

    with_a = db.query(func.count(Question.id)).filter(
        Question.is_active == True,
        Question.irt_discrimination_a.isnot(None)
    ).scalar()

    with_c = db.query(func.count(Question.id)).filter(
        Question.is_active == True,
        Question.irt_guessing_c.isnot(None)
    ).scalar()

    fully_calibrated = db.query(func.count(Question.id)).filter(
        Question.is_active == True,
        Question.irt_difficulty_b.isnot(None),
        Question.irt_discrimination_a.isnot(None),
        Question.irt_guessing_c.isnot(None)
    ).scalar()

    # Get parameter distributions
    b_stats = db.query(
        func.min(Question.irt_difficulty_b),
        func.max(Question.irt_difficulty_b),
        func.avg(Question.irt_difficulty_b)
    ).filter(
        Question.is_active == True,
        Question.irt_difficulty_b.isnot(None)
    ).first()

    a_stats = db.query(
        func.min(Question.irt_discrimination_a),
        func.max(Question.irt_discrimination_a),
        func.avg(Question.irt_discrimination_a)
    ).filter(
        Question.is_active == True,
        Question.irt_discrimination_a.isnot(None)
    ).first()

    return {
        "total_questions": total,
        "coverage": {
            "difficulty_b": with_b,
            "discrimination_a": with_a,
            "guessing_c": with_c,
            "fully_calibrated": fully_calibrated,
        },
        "percentages": {
            "difficulty_b": round(100 * with_b / total, 1) if total > 0 else 0,
            "discrimination_a": round(100 * with_a / total, 1) if total > 0 else 0,
            "guessing_c": round(100 * with_c / total, 1) if total > 0 else 0,
            "fully_calibrated": round(100 * fully_calibrated / total, 1) if total > 0 else 0,
        },
        "parameter_ranges": {
            "b": {
                "min": float(b_stats[0]) if b_stats[0] else None,
                "max": float(b_stats[1]) if b_stats[1] else None,
                "mean": float(b_stats[2]) if b_stats[2] else None,
            },
            "a": {
                "min": float(a_stats[0]) if a_stats[0] else None,
                "max": float(a_stats[1]) if a_stats[1] else None,
                "mean": float(a_stats[2]) if a_stats[2] else None,
            }
        }
    }
