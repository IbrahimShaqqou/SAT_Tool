"""
Tests for IRT (Item Response Theory) Service

Tests the 3PL IRT model functions including:
- Probability calculations
- Information functions
- Ability estimation (EAP and MLE)
- Adaptive question selection
- Parameter conversion utilities
"""

import pytest
import math

from app.services.irt_service import (
    probability_correct,
    probability_incorrect,
    item_information,
    calculate_test_information,
    standard_error,
    estimate_ability_eap,
    estimate_ability_mle,
    score_band_to_difficulty,
    difficulty_level_to_discrimination,
    get_guessing_parameter,
    PRIOR_MEAN,
    PRIOR_SD,
    DEFAULT_A,
    DEFAULT_B,
    DEFAULT_C_MCQ,
)
from app.models.enums import AnswerType


class TestProbabilityCorrect:
    """Tests for the 3PL probability function."""

    def test_probability_at_difficulty_equals_0_5_adjusted(self):
        """When theta equals b, probability should be (1+c)/2."""
        theta = 1.0
        a = 1.0
        b = 1.0  # theta == b
        c = 0.25

        prob = probability_correct(theta, a, b, c)

        # At theta = b, P = c + (1-c)/2 = (1+c)/2
        expected = (1 + c) / 2
        assert abs(prob - expected) < 0.01

    def test_probability_increases_with_ability(self):
        """Higher ability should give higher probability."""
        a, b, c = 1.0, 0.0, 0.25

        prob_low = probability_correct(-2.0, a, b, c)
        prob_mid = probability_correct(0.0, a, b, c)
        prob_high = probability_correct(2.0, a, b, c)

        assert prob_low < prob_mid < prob_high

    def test_probability_decreases_with_difficulty(self):
        """Higher difficulty should give lower probability for same ability."""
        theta = 0.0
        a, c = 1.0, 0.25

        prob_easy = probability_correct(theta, a, b=-2.0, c=c)
        prob_hard = probability_correct(theta, a, b=2.0, c=c)

        assert prob_easy > prob_hard

    def test_probability_bounded_by_c_and_1(self):
        """Probability should be between c and 1."""
        test_cases = [
            (-3.0, 1.0, 0.0, 0.25),  # Very low ability
            (3.0, 1.0, 0.0, 0.25),   # Very high ability
            (0.0, 2.0, -1.0, 0.0),   # No guessing
            (0.0, 0.5, 2.0, 0.5),    # High guessing
        ]

        for theta, a, b, c in test_cases:
            prob = probability_correct(theta, a, b, c)
            assert c <= prob <= 1.0, f"Failed for theta={theta}, a={a}, b={b}, c={c}"

    def test_probability_approaches_1_for_high_ability(self):
        """Very high ability should give probability near 1."""
        prob = probability_correct(5.0, 1.0, 0.0, 0.0)
        assert prob > 0.99

    def test_probability_approaches_c_for_low_ability(self):
        """Very low ability should give probability near c."""
        c = 0.25
        prob = probability_correct(-5.0, 1.0, 0.0, c)
        assert abs(prob - c) < 0.01

    def test_probability_incorrect_is_complement(self):
        """P(incorrect) should equal 1 - P(correct)."""
        theta, a, b, c = 0.5, 1.2, -0.5, 0.25

        p_correct = probability_correct(theta, a, b, c)
        p_incorrect = probability_incorrect(theta, a, b, c)

        assert abs((p_correct + p_incorrect) - 1.0) < 0.0001


class TestItemInformation:
    """Tests for the item information function."""

    def test_information_maximized_near_difficulty(self):
        """Information should be maximized when theta is near b."""
        a, b, c = 1.0, 0.0, 0.25

        info_at_b = item_information(b, a, b, c)
        info_far_below = item_information(b - 2, a, b, c)
        info_far_above = item_information(b + 2, a, b, c)

        assert info_at_b > info_far_below
        assert info_at_b > info_far_above

    def test_information_increases_with_discrimination(self):
        """Higher discrimination should give higher information."""
        theta, b, c = 0.0, 0.0, 0.25

        info_low_a = item_information(theta, a=0.5, b=b, c=c)
        info_high_a = item_information(theta, a=2.0, b=b, c=c)

        assert info_high_a > info_low_a

    def test_information_non_negative(self):
        """Information should never be negative."""
        test_cases = [
            (-2.0, 1.0, 0.0, 0.25),
            (0.0, 0.5, 1.0, 0.0),
            (2.0, 2.0, -1.0, 0.5),
        ]

        for theta, a, b, c in test_cases:
            info = item_information(theta, a, b, c)
            assert info >= 0, f"Negative information for theta={theta}, a={a}, b={b}, c={c}"


class TestAbilityEstimation:
    """Tests for ability estimation functions."""

    def test_eap_returns_prior_for_empty_responses(self):
        """With no responses, EAP should return the prior."""
        theta, se = estimate_ability_eap([])
        assert abs(theta - PRIOR_MEAN) < 0.01
        assert abs(se - PRIOR_SD) < 0.01

    def test_eap_increases_for_correct_responses(self):
        """Correct responses should increase ability estimate."""
        # Single correct response on easy item
        responses = [{"a": 1.0, "b": -1.0, "c": 0.25, "is_correct": True}]
        theta, se = estimate_ability_eap(responses)
        assert theta > PRIOR_MEAN

    def test_eap_decreases_for_incorrect_responses(self):
        """Incorrect responses should decrease ability estimate."""
        # Single incorrect response on easy item (should have gotten it right)
        responses = [{"a": 1.0, "b": -1.0, "c": 0.25, "is_correct": False}]
        theta, se = estimate_ability_eap(responses)
        assert theta < PRIOR_MEAN

    def test_eap_se_decreases_with_more_responses(self):
        """Standard error should decrease with more responses."""
        base_response = {"a": 1.0, "b": 0.0, "c": 0.25, "is_correct": True}

        _, se_1 = estimate_ability_eap([base_response])
        _, se_5 = estimate_ability_eap([base_response] * 5)
        _, se_10 = estimate_ability_eap([base_response] * 10)

        assert se_10 < se_5 < se_1

    def test_eap_responds_to_item_difficulty(self):
        """Getting hard items correct should give higher estimate than easy items."""
        easy_correct = [{"a": 1.0, "b": -2.0, "c": 0.25, "is_correct": True}]
        hard_correct = [{"a": 1.0, "b": 2.0, "c": 0.25, "is_correct": True}]

        theta_easy, _ = estimate_ability_eap(easy_correct)
        theta_hard, _ = estimate_ability_eap(hard_correct)

        assert theta_hard > theta_easy

    def test_mle_returns_reasonable_estimate(self):
        """MLE should return a reasonable ability estimate."""
        responses = [
            {"a": 1.0, "b": -1.0, "c": 0.25, "is_correct": True},
            {"a": 1.0, "b": 0.0, "c": 0.25, "is_correct": True},
            {"a": 1.0, "b": 1.0, "c": 0.25, "is_correct": False},
        ]

        theta, se = estimate_ability_mle(responses)

        # Should be somewhere in the middle
        assert -3 < theta < 3
        assert se > 0


class TestParameterConversion:
    """Tests for converting metadata to IRT parameters."""

    def test_score_band_to_difficulty_mapping(self):
        """Score band should map to difficulty correctly."""
        # Low score band = easy = negative b
        b_low = score_band_to_difficulty(1)
        assert b_low < 0

        # High score band = hard = positive b
        b_high = score_band_to_difficulty(8)
        assert b_high > 0

        # Middle score band = near zero
        b_mid = score_band_to_difficulty(5)
        assert abs(b_mid) < 1

    def test_score_band_monotonic(self):
        """Higher score band should give higher difficulty."""
        for i in range(1, 8):
            b_lower = score_band_to_difficulty(i)
            b_higher = score_band_to_difficulty(i + 1)
            assert b_higher > b_lower

    def test_difficulty_level_to_discrimination(self):
        """Difficulty levels should map to discrimination correctly."""
        a_easy = difficulty_level_to_discrimination("EASY")
        a_medium = difficulty_level_to_discrimination("MEDIUM")
        a_hard = difficulty_level_to_discrimination("HARD")

        # Harder items tend to have higher discrimination
        assert a_easy < a_medium < a_hard

        # Also test single-letter codes
        assert difficulty_level_to_discrimination("E") == a_easy
        assert difficulty_level_to_discrimination("M") == a_medium
        assert difficulty_level_to_discrimination("H") == a_hard

    def test_difficulty_level_none_returns_default(self):
        """None difficulty should return default discrimination."""
        a = difficulty_level_to_discrimination(None)
        assert a == DEFAULT_A

    def test_guessing_parameter_by_answer_type(self):
        """MCQ should have higher guessing than SPR."""
        c_mcq = get_guessing_parameter(AnswerType.MCQ)
        c_spr = get_guessing_parameter(AnswerType.SPR)

        assert c_mcq == 0.25  # 4-choice MCQ
        assert c_spr == 0.0   # No guessing for SPR


class TestTestInformation:
    """Tests for test-level information calculations."""

    def test_total_information_is_sum_of_item_information(self):
        """Test information should be sum of item informations."""
        items = [
            {"a": 1.0, "b": -1.0, "c": 0.25},
            {"a": 1.5, "b": 0.0, "c": 0.25},
            {"a": 1.0, "b": 1.0, "c": 0.25},
        ]
        theta = 0.0

        total_info = calculate_test_information(theta, items)
        sum_info = sum(item_information(theta, **item) for item in items)

        assert abs(total_info - sum_info) < 0.0001

    def test_standard_error_decreases_with_more_items(self):
        """SE should decrease as more items are added."""
        theta = 0.0
        item = {"a": 1.0, "b": 0.0, "c": 0.25}

        se_1 = standard_error(theta, [item])
        se_5 = standard_error(theta, [item] * 5)
        se_10 = standard_error(theta, [item] * 10)

        assert se_10 < se_5 < se_1


class TestEdgeCases:
    """Tests for edge cases and numerical stability."""

    def test_extreme_theta_values(self):
        """Functions should handle extreme theta values."""
        for theta in [-10, -5, 5, 10]:
            prob = probability_correct(theta, 1.0, 0.0, 0.25)
            assert 0.25 <= prob <= 1.0

            info = item_information(theta, 1.0, 0.0, 0.25)
            assert info >= 0

    def test_extreme_discrimination(self):
        """Functions should handle extreme discrimination values."""
        for a in [0.1, 5.0]:
            prob = probability_correct(0.0, a, 0.0, 0.25)
            assert 0.25 <= prob <= 1.0

    def test_zero_guessing(self):
        """Functions should work with zero guessing parameter."""
        prob = probability_correct(0.0, 1.0, 0.0, 0.0)
        assert 0.0 <= prob <= 1.0

        info = item_information(0.0, 1.0, 0.0, 0.0)
        assert info > 0

    def test_all_correct_responses(self):
        """Estimation should handle all-correct response pattern."""
        responses = [
            {"a": 1.0, "b": b, "c": 0.25, "is_correct": True}
            for b in [-2.0, -1.0, 0.0, 1.0, 2.0]
        ]

        theta_eap, se_eap = estimate_ability_eap(responses)
        theta_mle, se_mle = estimate_ability_mle(responses)

        # Both should give above-average ability estimate
        assert theta_eap > 0.5, f"EAP too low: {theta_eap}"
        assert theta_mle > 0.5, f"MLE too low: {theta_mle}"

    def test_all_incorrect_responses(self):
        """Estimation should handle all-incorrect response pattern."""
        responses = [
            {"a": 1.0, "b": b, "c": 0.25, "is_correct": False}
            for b in [-2.0, -1.0, 0.0, 1.0, 2.0]
        ]

        theta_eap, se_eap = estimate_ability_eap(responses)
        theta_mle, se_mle = estimate_ability_mle(responses)

        # Both should give low ability estimate
        assert theta_eap < -1.0
        assert theta_mle < -1.0
