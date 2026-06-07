"""Tests for anchor-based SAT scoring (real captured CB anchors)."""

from app.services.anchor_scoring import score_section_from_anchors, has_anchor_data
from app.services.sat_scoring import score_full_length_test


class TestAnchorLookup:
    def test_exact_anchor_is_official(self):
        # PT4 Math harder has a real anchor 22 -> 550.
        r = score_section_from_anchors(4, "math", 22, "harder")
        assert r is not None
        assert r["method"] == "official"
        assert r["score"] == 550
        assert r["low"] == r["high"] == 550

    def test_interpolation_is_estimate_and_bracketed(self):
        # Between 22->550 and 28->630.
        r = score_section_from_anchors(4, "math", 25, "harder")
        assert r is not None
        assert r["method"] == "estimate"
        assert 550 <= r["score"] <= 630
        assert r["low"] < r["score"] < r["high"]

    def test_interpolation_is_monotonic(self):
        prev = 0
        for raw in range(0, 40):
            r = score_section_from_anchors(4, "math", raw, "harder")
            if r:
                assert r["score"] >= prev
                prev = r["score"]

    def test_out_of_range_returns_none(self):
        # Max captured PT4 math harder anchor is 39.
        assert score_section_from_anchors(4, "math", 40, "harder") is None

    def test_thin_data_returns_none(self):
        # PT4 RW easier only has the (0->200) floor -> can't bracket.
        assert score_section_from_anchors(4, "reading_writing", 10, "easier") is None

    def test_unknown_test_returns_none(self):
        assert score_section_from_anchors(99, "math", 20, "harder") is None

    def test_has_anchor_data(self):
        assert has_anchor_data(4, "math", "harder") is True
        assert has_anchor_data(99, "math", "harder") is False


class TestFullLengthScoring:
    def test_official_when_both_sections_anchored(self):
        # PT4: perfect M1, zero M2 -> harder path -> exact official anchors.
        res = score_full_length_test(
            22, 22, 0, 22, 27, 27, 0, 27, test_number=4
        )
        assert res["math"]["score_method"] == "official"
        assert res["reading_writing"]["score_method"] == "official"
        assert res["score_method"] == "official"
        assert res["math"]["score"] == 550
        assert res["reading_writing"]["score"] == 530
        assert res["total_score"] == 1080

    def test_falls_back_to_model_without_test_number(self):
        res = score_full_length_test(22, 22, 10, 22, 27, 27, 12, 27)
        assert res["score_method"] == "model"
        assert 400 <= res["total_score"] <= 1600

    def test_unknown_test_uses_model(self):
        res = score_full_length_test(22, 22, 10, 22, 27, 27, 12, 27, test_number=99)
        assert res["score_method"] == "model"

    def test_total_range_present(self):
        res = score_full_length_test(22, 22, 0, 22, 27, 27, 0, 27, test_number=4)
        assert res["total_score_low"] <= res["total_score"] <= res["total_score_high"]
