"""
Anchor-based SAT section scoring.

The real digital SAT converts a section's raw score to a scaled score (200-800)
via a per-form, IRT-equated table that College Board does not publish. We can't
reproduce it exactly, but we captured REAL (raw -> scaled) outputs from actual
Bluebook attempts (see data/sat_score_anchors.json), separated by Module 2 path
(easier vs harder), because the path shifts the achievable range.

This module scores a section by:
  - EXACT  : the raw count matches a real captured anchor -> return it, flagged
             "official" (it literally is College Board's number).
  - INTERP : the raw count falls between two real anchors -> linear interpolation,
             flagged "estimate" with a +/- band.
  - FALLBACK: too few bracketing anchors -> caller uses the calibrated linear model.

Everything is monotonic-by-construction: anchors are sorted by raw and we only
interpolate between increasing points; we also clamp so more-correct never scores
lower within a path.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

_ANCHORS_PATH = Path(__file__).parent.parent.parent / "data" / "sat_score_anchors.json"

# Uncertainty band (scaled points) reported for interpolated estimates.
INTERP_BAND = 30


@lru_cache(maxsize=1)
def _load_anchors() -> dict:
    try:
        return json.loads(_ANCHORS_PATH.read_text())
    except FileNotFoundError:
        return {"tests": {}}


def _curve(test_number: int, section: str, path: str) -> list[tuple[int, int]]:
    """Return sorted, monotonic [(raw, scaled), ...] for this test/section/path."""
    tests = _load_anchors().get("tests", {})
    node = tests.get(str(test_number), {}).get(section, {})
    pts = node.get(path) or []
    # Sort by raw, enforce non-decreasing scaled (clamp regressions).
    pts = sorted((int(r), int(s)) for r, s in pts)
    out: list[tuple[int, int]] = []
    best = 0
    for r, s in pts:
        s = max(s, best)
        best = s
        out.append((r, s))
    return out


def score_section_from_anchors(
    test_number: int,
    section: str,          # "math" | "reading_writing"
    raw_correct: int,
    path: str,             # "easier" | "harder"
) -> Optional[dict]:
    """
    Score a section from real anchors.

    Returns None when there aren't enough anchors to bracket the raw count
    (caller should fall back to the linear model). Otherwise returns:
        {
          "score": int,            # nearest 10
          "low": int, "high": int, # range (equal to score when exact)
          "method": "official" | "estimate",
          "anchors_used": [[raw, scaled], ...],
        }
    """
    curve = _curve(test_number, section, path)
    if len(curve) < 2:
        return None

    raws = [r for r, _ in curve]
    lo_raw, hi_raw = raws[0], raws[-1]

    def rnd(x: float) -> int:
        return max(200, min(800, int(round(x / 10) * 10)))

    # Exact match -> official.
    for r, s in curve:
        if r == raw_correct:
            return {
                "score": rnd(s),
                "low": rnd(s),
                "high": rnd(s),
                "method": "official",
                "anchors_used": [[r, s]],
            }

    # Outside the captured range -> not safe to extrapolate; fall back.
    if raw_correct < lo_raw or raw_correct > hi_raw:
        return None

    # Interpolate between the two bracketing anchors.
    lower = max((p for p in curve if p[0] < raw_correct), key=lambda p: p[0])
    upper = min((p for p in curve if p[0] > raw_correct), key=lambda p: p[0])
    (r0, s0), (r1, s1) = lower, upper
    frac = (raw_correct - r0) / (r1 - r0)
    est = s0 + frac * (s1 - s0)
    score = rnd(est)
    return {
        "score": score,
        "low": rnd(est - INTERP_BAND),
        "high": rnd(est + INTERP_BAND),
        "method": "estimate",
        "anchors_used": [list(lower), list(upper)],
    }


def has_anchor_data(test_number: int, section: str, path: str) -> bool:
    return len(_curve(test_number, section, path)) >= 2
