"""
SAT Scoring Service

Implements SAT scaled scoring algorithm based on 2-stage adaptive testing.

Based on research:
- Digital SAT uses 2-stage adaptive testing
- Module 1 is fixed difficulty for all students
- Module 2 adapts (easier or harder) based on Module 1 performance
- ~55% threshold determines which Module 2 path
- Harder Module 2 allows higher scaled scores
- Easier Module 2 has lower ceiling (~680 vs 800)
"""

from typing import Tuple


# Adaptive threshold (percentage correct on Module 1 to get harder Module 2)
ADAPTIVE_THRESHOLD = 0.55  # 55% correct


def should_get_harder_module_2(module_1_correct: int, module_1_total: int) -> bool:
    """
    Determine if student should get harder Module 2.

    Args:
        module_1_correct: Number of correct answers in Module 1
        module_1_total: Total questions in Module 1

    Returns:
        True if student scored >= 55% and should get harder Module 2
    """
    if module_1_total == 0:
        return False

    percentage = module_1_correct / module_1_total
    return percentage >= ADAPTIVE_THRESHOLD


def calculate_sat_section_score(
    total_correct: int,
    total_questions: int,
    got_harder_module_2: bool
) -> int:
    """
    Calculate SAT scaled score (200-800) for a section.

    Uses different scoring curves based on which Module 2 path was taken.

    Args:
        total_correct: Total correct answers (Module 1 + Module 2)
        total_questions: Total questions (Module 1 + Module 2)
        got_harder_module_2: Whether student took harder Module 2 path

    Returns:
        Scaled score from 200 to 800

    Examples:
        Math (44 questions total):
        - 44/44 correct, harder path → 800
        - 22/44 correct (50%), harder path → ~550
        - 22/44 correct (50%), easier path → ~450
        - 44/44 correct, easier path → ~680 (ceiling)
    """
    if total_questions == 0:
        return 200

    percentage = total_correct / total_questions

    if got_harder_module_2:
        # Harder Module 2: Better scaling curve, max score 800
        if percentage < 0.5:
            # Below 50%: 200-550 range
            score = 200 + (percentage * 2 * 350)
        else:
            # Above 50%: 550-800 range
            score = 550 + ((percentage - 0.5) * 2 * 250)
    else:
        # Easier Module 2: Lower ceiling, max score ~680
        if percentage < 0.5:
            # Below 50%: 200-450 range
            score = 200 + (percentage * 2 * 250)
        else:
            # Above 50%: 450-680 range
            score = 450 + ((percentage - 0.5) * 2 * 230)

    # Round to nearest 10 (SAT scores are in 10-point increments)
    score = round(score / 10) * 10

    # Clamp to 200-800 range
    return max(200, min(800, int(score)))


def calculate_total_sat_score(math_score: int, rw_score: int) -> int:
    """
    Calculate total SAT score (400-1600).

    Args:
        math_score: Math section score (200-800)
        rw_score: Reading/Writing section score (200-800)

    Returns:
        Total SAT score (400-1600)
    """
    total = math_score + rw_score
    return max(400, min(1600, total))


def estimate_percentile(total_score: int) -> int:
    """
    Estimate SAT percentile based on total score.

    Based on approximate College Board percentile data.

    Args:
        total_score: Total SAT score (400-1600)

    Returns:
        Estimated percentile (1-99)
    """
    # Approximate percentile mapping (2024 data)
    percentile_map = {
        1600: 99,
        1550: 99,
        1500: 98,
        1450: 96,
        1400: 94,
        1350: 91,
        1300: 87,
        1250: 82,
        1200: 75,
        1150: 68,
        1100: 59,
        1050: 50,
        1000: 40,
        950: 31,
        900: 23,
        850: 16,
        800: 10,
        750: 6,
        700: 3,
        650: 1,
        600: 1,
    }

    # Find closest score
    for score_threshold in sorted(percentile_map.keys(), reverse=True):
        if total_score >= score_threshold:
            return percentile_map[score_threshold]

    return 1


def score_full_length_test(
    math_module_1_correct: int,
    math_module_1_total: int,
    math_module_2_correct: int,
    math_module_2_total: int,
    rw_module_1_correct: int,
    rw_module_1_total: int,
    rw_module_2_correct: int,
    rw_module_2_total: int
) -> dict:
    """
    Score a complete full-length SAT test.

    Args:
        math_module_1_correct: Correct answers in Math Module 1
        math_module_1_total: Total questions in Math Module 1
        math_module_2_correct: Correct answers in Math Module 2
        math_module_2_total: Total questions in Math Module 2
        rw_module_1_correct: Correct answers in R/W Module 1
        rw_module_1_total: Total questions in R/W Module 1
        rw_module_2_correct: Correct answers in R/W Module 2
        rw_module_2_total: Total questions in R/W Module 2

    Returns:
        Dictionary with detailed scoring breakdown
    """
    # Determine which Module 2 paths were taken
    math_got_harder = should_get_harder_module_2(
        math_module_1_correct,
        math_module_1_total
    )
    rw_got_harder = should_get_harder_module_2(
        rw_module_1_correct,
        rw_module_1_total
    )

    # Calculate section scores
    math_total_correct = math_module_1_correct + math_module_2_correct
    math_total_questions = math_module_1_total + math_module_2_total
    math_score = calculate_sat_section_score(
        math_total_correct,
        math_total_questions,
        math_got_harder
    )

    rw_total_correct = rw_module_1_correct + rw_module_2_correct
    rw_total_questions = rw_module_1_total + rw_module_2_total
    rw_score = calculate_sat_section_score(
        rw_total_correct,
        rw_total_questions,
        rw_got_harder
    )

    # Calculate total score
    total_score = calculate_total_sat_score(math_score, rw_score)
    percentile = estimate_percentile(total_score)

    return {
        "total_score": total_score,
        "percentile": percentile,
        "math": {
            "score": math_score,
            "correct": math_total_correct,
            "total": math_total_questions,
            "percentage": (math_total_correct / math_total_questions * 100) if math_total_questions > 0 else 0,
            "module_1_correct": math_module_1_correct,
            "module_1_total": math_module_1_total,
            "module_2_correct": math_module_2_correct,
            "module_2_total": math_module_2_total,
            "module_2_path": "harder" if math_got_harder else "easier"
        },
        "reading_writing": {
            "score": rw_score,
            "correct": rw_total_correct,
            "total": rw_total_questions,
            "percentage": (rw_total_correct / rw_total_questions * 100) if rw_total_questions > 0 else 0,
            "module_1_correct": rw_module_1_correct,
            "module_1_total": rw_module_1_total,
            "module_2_correct": rw_module_2_correct,
            "module_2_total": rw_module_2_total,
            "module_2_path": "harder" if rw_got_harder else "easier"
        }
    }
