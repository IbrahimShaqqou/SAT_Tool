"""
Shared answer-checking logic for SPR and MCQ questions.

Handles:
- MCQ: simple index comparison
- SPR: exact string match, numeric equivalence, fraction evaluation, wildcard "*"
"""

from fractions import Fraction
from typing import List, Optional


def _try_numeric(value: str) -> Optional[float]:
    """Try to parse a string as a number, including fractions like '3/4'."""
    try:
        return float(Fraction(value))
    except (ValueError, ZeroDivisionError):
        try:
            return float(value)
        except (ValueError, OverflowError):
            return None


def _numeric_match(user: str, correct: str, tolerance: float = 0.01) -> bool:
    """Check if two values are numerically equal within tolerance."""
    u = _try_numeric(user)
    c = _try_numeric(correct)
    if u is not None and c is not None:
        return abs(u - c) < tolerance
    return False


def check_spr_answer(submitted: str, correct_answers: List[str]) -> bool:
    """
    Check an SPR answer against the list of accepted answers.

    - Wildcard "*" means any non-empty answer is accepted
    - Exact string match (case-insensitive, trimmed)
    - Numeric equivalence: "0.5" matches ".5" matches "1/2"
    """
    user = submitted.strip().lower()
    if not user:
        return False

    for ans in correct_answers:
        a = str(ans).strip().lower()

        # Wildcard: can't grade this question — shouldn't be served, but
        # handle gracefully if it slips through (don't penalize the student)
        if a == "*":
            return True

        # Exact string match
        if user == a:
            return True

        # Numeric equivalence
        if _numeric_match(user, a):
            return True

    return False


def check_answer(correct_answer_json: dict, submitted_answer: dict, answer_type: str) -> bool:
    """
    Check if a submitted answer is correct.

    Args:
        correct_answer_json: The question's correct_answer_json field
        submitted_answer: The student's response_json (e.g. {"index": 2} or {"answer": "42"})
        answer_type: "MCQ" or "SPR"

    Returns:
        True if the answer is correct
    """
    if not correct_answer_json or not submitted_answer:
        return False

    if answer_type == "MCQ":
        return submitted_answer.get("index") == correct_answer_json.get("index")

    # SPR
    user_answer = str(submitted_answer.get("answer", "")).strip()
    correct_answers = correct_answer_json.get("answers", [])
    return check_spr_answer(user_answer, correct_answers)
