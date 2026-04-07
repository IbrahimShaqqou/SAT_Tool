#!/usr/bin/env python3
"""
normalize_questions.py

Phase 1 Question Normalization:
  1. Translate every <img class="math-img" alt="..."> in stored HTML to
     a LaTeX <span class="math-inline">\\(LATEX\\)</span> using a Python
     port of the existing JS altTextToLatex converter (extended with patterns
     observed in the full alt-text corpus).
  2. Fix real image sizing: strip CB-hardcoded width/height attrs and add
     responsive inline style (max-width: 100%; height: auto).
  3. Write cleaned HTML back to prompt_html, choices_json, explanation_html
     in the DB.
  4. Cache alt→latex translations to data/math_alt_cache.json so reruns
     are cheap and the file can be spot-checked before committing.

Usage:
    # 1. Build translation cache only (no DB writes) — review output first
    python -m scripts.normalize_questions --cache-only

    # 2. Dry run — shows what would change, no writes
    python -m scripts.normalize_questions --dry-run

    # 3. Full migration
    python -m scripts.normalize_questions

    # 4. Limit to N questions for testing
    python -m scripts.normalize_questions --limit 20

    # 5. Check how many math-img tags still remain in DB
    python -m scripts.normalize_questions --check
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup, Tag

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.question import Question

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "math_alt_cache.json"
ALTS_FILE  = DATA_DIR / "math_alts_raw.json"


# ─────────────────────────────────────────────────────────────────────────────
# ALT-TEXT → LaTeX CONVERTER
# Python port of frontend/src/utils/mathImageUtils.js :: altTextToLatex
# Extended with patterns observed in the full CB alt-text corpus.
# ─────────────────────────────────────────────────────────────────────────────

# Word-form numerals (one through twenty + common large ones)
WORD_NUMS: dict[str, int] = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "twenty-one": 21, "twenty-two": 22,
    "twenty-three": 23, "thirty": 30, "thirty-eight": 38, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
    "zero": 0,
}

ORDINALS: dict[str, int] = {
    "half": 2, "halves": 2,
    "third": 3, "thirds": 3,
    "fourth": 4, "fourths": 4, "quarter": 4, "quarters": 4,
    "fifth": 5, "fifths": 5,
    "sixth": 6, "sixths": 6,
    "seventh": 7, "sevenths": 7,
    "eighth": 8, "eighths": 8,
    "ninth": 9, "ninths": 9,
    "tenth": 10, "tenths": 10,
    "eleventh": 11, "elevenths": 11,
    "twelfth": 12, "twelfths": 12,
    "hundredth": 100, "hundredths": 100,
}

# Irregular ordinal → integer (covers 1–20 and round tens up to 100)
# All other ordinals are derived algorithmically by _ordinal_to_int().
_ORDINAL_SINGLES: dict[str, int] = {
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5,
    "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
    "eleventh": 11, "twelfth": 12, "thirteenth": 13, "fourteenth": 14,
    "fifteenth": 15, "sixteenth": 16, "seventeenth": 17, "eighteenth": 18,
    "nineteenth": 19, "twentieth": 20,
    "thirtieth": 30, "fortieth": 40, "fiftieth": 50,
    "sixtieth": 60, "seventieth": 70, "eightieth": 80, "ninetieth": 90,
    "hundredth": 100,
}


def _ordinal_to_int(phrase: str) -> Optional[int]:
    """
    Convert an ordinal word or short phrase to an integer.

    Handles:
      • Simple irregulars:  "fifth" → 5, "twelfth" → 12
      • Round tens:         "thirtieth" → 30, "fiftieth" → 50
      • Compound (tens+ones): "twenty ninth" → 29, "thirty second" → 32
      • Digit ordinals:     "21st", "103rd" → 21, 103

    Returns None if the phrase cannot be recognised as an ordinal.
    """
    p = phrase.lower().strip()

    # Direct table lookup
    if p in _ORDINAL_SINGLES:
        return _ORDINAL_SINGLES[p]

    # Digit ordinals: "21st", "2nd", "103rd" …
    m = re.fullmatch(r"(\d+)(?:st|nd|rd|th)", p)
    if m:
        return int(m.group(1))

    # Compound ordinals: "twenty ninth", "thirty second", "forty fifth" …
    parts = p.split(None, 1)  # split on first whitespace
    if len(parts) == 2:
        tens = WORD_NUMS.get(parts[0])           # "twenty" → 20
        ones = _ORDINAL_SINGLES.get(parts[1])    # "ninth"  → 9
        if tens is not None and ones is not None and 1 <= ones <= 9:
            return tens + ones

    return None

ORDINAL_PAT = (
    r"half|halves|thirds?|fourths?|quarters?|fifths?|sixths?|sevenths?|"
    r"eighths?|ninths?|tenths?|elevenths?|twelfths?|hundredths?"
)

WORD_NUM_PAT = (
    r"zero|one|two|three|four|five|six|seven|eight|nine|ten|"
    r"eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
    r"eighteen|nineteen|twenty(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|"
    r"twenty-three|thirty(?:-eight)?|forty|fifty|sixty|seventy|eighty|ninety"
)


def _word_num(w: str) -> Optional[int]:
    """Return integer for a word-form numeral, or None."""
    return WORD_NUMS.get(w.lower().replace("–", "-"))


def alt_text_to_latex(raw: str) -> str:  # noqa: C901  (complexity ok for a converter)
    """Convert a CB math alt-text string to a LaTeX string."""
    if not raw or not raw.strip():
        return ""

    s = raw.strip()

    # ── strip noise prefixes ─────────────────────────────────────────────────
    s = re.sub(r"^as follows:\s*", "", s, flags=re.I)
    s = re.sub(r"^third value,\s*", "", s, flags=re.I)

    # ── strip punctuation commas (CB pause markers) ──────────────────────────
    # Semantic commas are always written as the word "comma".
    s = s.replace(",", " ")

    # ── CB fraction / root delimiters ────────────────────────────────────────
    s = re.sub(r"\bstart fraction\b", "", s, flags=re.I)
    s = re.sub(r"\bend fraction\b",   "", s, flags=re.I)
    s = re.sub(r"\bstart root\b",           r"the square root of", s, flags=re.I)
    s = re.sub(r"\bstart square root\b",    r"the square root of", s, flags=re.I)
    # NOTE: "end root" / "end square root" are NOT stripped here — they are
    # used as explicit delimiters in the sqrt rules below, which lets complex
    # expressions like "the square root of b squared minus 4ac end root" parse
    # correctly (stopping at "end root" rather than stopping at "minus").
    s = re.sub(r"\bend subscript\b",        "",  s, flags=re.I)
    s = re.sub(r"\bend superscript\b",      "",  s, flags=re.I)
    # NOTE: "end power" is NOT stripped here — it's used as a delimiter
    # in the power rules below so multi-word exponents parse correctly.
    s = re.sub(r"\bend parenthesis\b",      ")",  s, flags=re.I)
    s = re.sub(r"\bopen brace\b",           "",  s, flags=re.I)
    s = re.sub(r"\bclose brace\b",          "",  s, flags=re.I)

    # ── hyphenated word-fractions ("three-fourths") ──────────────────────────
    def _hyphen_frac(m: re.Match) -> str:
        n = _word_num(m.group(1))
        d = ORDINALS.get(m.group(2).lower())
        if n is not None and d:
            return rf"\frac{{{n}}}{{{d}}}"
        return m.group(0)

    s = re.sub(
        rf"({WORD_NUM_PAT})-({ORDINAL_PAT})\b(?!\s+(?:power\b|end\s+power\b))",
        _hyphen_frac, s, flags=re.I,
    )

    # ── decimal conversion FIRST (before "over" rules consume decimal tokens) ─
    # "zero" → "0" in decimal contexts
    s = re.sub(r"\bzero\s+point\b",    "0 point", s, flags=re.I)
    # "N point zero" → "N.0"
    s = re.sub(r"\b(\d+)\s+point\s+zero\b", r"\1.0", s, flags=re.I)
    # "N point D1 D2..." FIRST — handles the common case (e.g. "7 point 5" → "7.5")
    # Use \d+ to handle multi-digit chunks like "2 point 95"
    def _decimal(m: re.Match) -> str:
        digits = re.sub(r"\s+", "", m.group(2))
        return f"{m.group(1)}.{digits}"
    s = re.sub(r"\b(\d+)\s+point\s+((?:\d+\s+)*\d+)(?=\s|$)", _decimal, s, flags=re.I)
    # "point N" with no preceding digit — bare decimal like ".20" (e.g. "times point 2 0")
    # Only after the N-point-M rule so we don't double-fire
    s = re.sub(r"(?<![.\d])(?<=\s)point\s+((?:\d+\s+)*\d+)(?=\s|$)",
               lambda m: "." + re.sub(r"\s+", "", m.group(1)), s, flags=re.I)

    # ── "the negative fraction X over Y" ────────────────────────────────────
    def _neg_frac(m: re.Match) -> str:
        return rf"-\frac{{{alt_text_to_latex(m.group(1))}}}{{{alt_text_to_latex(m.group(2))}}}"

    s = re.sub(
        r"\bthe negative fraction\s+(.+?)\s+over\s+(.+?)(?=\s*(?:$|\band\b|\bplus\b|\bminus\b|\btimes\b|\bequals\b|\bis\b))",
        _neg_frac, s, flags=re.I,
    )

    # ── ordinal fractions ────────────────────────────────────────────────────
    # Guard: don't fire when the ordinal is part of an exponent phrase.
    # "twenty ninth power" must NOT become \frac{20}{9} — the power rules
    # handle it as a compound ordinal exponent.
    _NOT_POWER = r"(?!\s+(?:power\b|end\s+power\b))"

    # digit numerator: "4 thirds", "38 halves"
    def _ord_digit(m: re.Match) -> str:
        d = ORDINALS.get(m.group(2).lower())
        return rf"\frac{{{m.group(1)}}}{{{d}}}" if d else m.group(0)

    s = re.sub(rf"(-?\d+)\s+({ORDINAL_PAT})\b" + _NOT_POWER, _ord_digit, s, flags=re.I)

    # word numerator: "two thirds", "three fourths"
    def _ord_word(m: re.Match) -> str:
        n = _word_num(m.group(1))
        d = ORDINALS.get(m.group(2).lower())
        return rf"\frac{{{n}}}{{{d}}}" if (n is not None and d) else m.group(0)

    s = re.sub(rf"({WORD_NUM_PAT})\s+({ORDINAL_PAT})\b" + _NOT_POWER, _ord_word, s, flags=re.I)

    # ── "the fraction with numerator X and denominator Y" ────────────────────
    def _frac_nd(m: re.Match) -> str:
        return rf"\frac{{{alt_text_to_latex(m.group(1))}}}{{{alt_text_to_latex(m.group(2))}}}"

    # _STOP_INNER: denominator can contain sub-expressions with "power" in them
    # (e.g. "the cube root of x to the fourth power, end root") so we do NOT
    # stop at "power" here.  We DO stop at top-level operators and equals.
    _STOP_INNER = r"(?=\s*(?:end fraction|$|\bplus\b|\bminus\b|\btimes\b|\bequals\b|\bis\b))"

    # _STOP: used for simpler "the fraction X over Y" where "power" at the end
    # signals this fraction is itself an exponent (e.g. "raised to the fraction
    # 7 over 6, power") — stop before that trailing "power".
    _STOP = r"(?=\s*(?:end fraction|$|\band\b|\bplus\b|\bminus\b|\btimes\b|\bequals\b|\bis\b|\bpower\b|\bend power\b))"

    s = re.sub(
        r"\bthe fraction with numerator\s+(.+?)\s+and denominator\s+(.+?)" + _STOP_INNER,
        _frac_nd, s, flags=re.I,
    )

    # ── "the fraction X over Y" ───────────────────────────────────────────────
    def _frac_over_long(m: re.Match) -> str:
        return rf"\frac{{{alt_text_to_latex(m.group(1))}}}{{{alt_text_to_latex(m.group(2))}}}"

    s = re.sub(
        r"\bthe fraction\s+(.+?)\s+over\s+(.+?)" + _STOP,
        _frac_over_long, s, flags=re.I,
    )

    # simple "X over Y" (single tokens or already-converted fragments)
    def _simple_over(m: re.Match) -> str:
        return rf"\frac{{{alt_text_to_latex(m.group(1))}}}{{{alt_text_to_latex(m.group(2))}}}"

    s = re.sub(r"\b([\w.\\{}]+)\s+over\s+([\w.\\{}]+)\b", _simple_over, s, flags=re.I)


    # ── roots ─────────────────────────────────────────────────────────────────
    def _sqrt(m: re.Match) -> str:
        return rf"\sqrt{{{alt_text_to_latex(m.group(1))}}}"

    def _cbrt(m: re.Match) -> str:
        return rf"\sqrt[3]{{{alt_text_to_latex(m.group(1))}}}"

    # Prefer "end root" delimiter (handles expressions containing "minus")
    s = re.sub(
        r"\bthe square root of\s+(.+?)\s+end (?:square )?root\b",
        _sqrt, s, flags=re.I,
    )
    # Fallback: stop at structural words (fine for simple single-term args)
    s = re.sub(
        r"\bthe square root of\s+(.+?)(?=\s*(?:$|\band\b|\bequals\b|\btimes\b|\bwhich\b|\bover\b))",
        _sqrt, s, flags=re.I,
    )
    # Clean up any remaining bare "end root" / "end square root"
    s = re.sub(r"\bend (?:square )?root\b", "", s, flags=re.I)

    s = re.sub(
        r"\bthe cube root of\s+(.+?)(?=\s*(?:$|\band\b|\bequals\b))",
        _cbrt, s, flags=re.I,
    )
    s = re.sub(
        r"\bthe nth root of\s+(.+?)(?=\s*(?:$|\band\b))",
        lambda m: rf"\sqrt[n]{{{alt_text_to_latex(m.group(1))}}}",
        s, flags=re.I,
    )

    # ── parentheses ───────────────────────────────────────────────────────────
    s = re.sub(r"\bleft parenthesis\b",  "(", s, flags=re.I)
    s = re.sub(r"\bright parenthesis\b", ")", s, flags=re.I)
    s = re.sub(r"\bopen parenthesis\b",  "(", s, flags=re.I)
    s = re.sub(r"\bclose parenthesis\b", ")", s, flags=re.I)

    # ── powers / exponents ────────────────────────────────────────────────────
    s = re.sub(r"\bsquared\b",  "^{2}", s, flags=re.I)
    s = re.sub(r"\bcubed\b",    "^{3}", s, flags=re.I)

    def _to_power(m: re.Match) -> str:
        raw = m.group(1).strip()
        # Try ordinal conversion first (handles "fifth"→5, "twenty ninth"→29,
        # "thirtieth"→30, "forty second"→42, "21st"→21, etc.)
        n = _ordinal_to_int(raw)
        if n is not None:
            return rf"^{{{n}}}"
        exp = alt_text_to_latex(raw)
        # Strip digit-based ordinal suffixes left after recursion (e.g. "2nd"→"2")
        exp = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", exp)
        return rf"^{{{exp}}}"

    # "raised to the fraction X over Y, power" → ^{\frac{X}{Y}}
    def _raised_frac(m: re.Match) -> str:
        num = alt_text_to_latex(m.group(1))
        den = alt_text_to_latex(m.group(2))
        return rf"^{{\frac{{{num}}}{{{den}}}}}"

    s = re.sub(
        r"\braised to the (?:fraction\s+)?(.+?)\s+over\s+(.+?)[,\s]+power\b",
        _raised_frac, s, flags=re.I,
    )

    # "to the power X end power" → ^{X}   (multi-word exponents with delimiter)
    s = re.sub(r"\bto the power\s+(.+?)\s+end power\b", _to_power, s, flags=re.I)
    # "to the power of X" — must run before "to the power X" to avoid capturing "of"
    s = re.sub(r"\bto the power of\s+(\S+)\b",           _to_power, s, flags=re.I)
    # "to the power X" (no end-power delimiter — single token, not "of")
    s = re.sub(r"\bto the power\s+(?!of\b)(\S+)\b",      _to_power, s, flags=re.I)
    # strip bare "end power" left over from expressions already handled
    s = re.sub(r"\bend power\b", "", s, flags=re.I)

    # "raised to the X power" / "to the X power"
    s = re.sub(r"\braised to the\s+(.+?)\s+power\b", _to_power, s, flags=re.I)
    # "raised to EXPR power" (after fractions already substituted, "the" is gone)
    s = re.sub(r"\braised to\s+(.+?)\s+power\b",     _to_power, s, flags=re.I)
    s = re.sub(r"\bto the power of\s+(\S+)\b",       _to_power, s, flags=re.I)
    s = re.sub(r"\bto the\s+(.+?)\s+power\b",          _to_power, s, flags=re.I)
    # Catch-all: "to the X" where X is a math token — single letter, number, or
    # LaTeX fragment.  Deliberately does NOT match multi-letter English words
    # (e.g. "added to the equation" must NOT become "added ^{equation}").
    s = re.sub(
        r"\bto the\s+(-?(?:[a-zA-Z]|\d[\d.]*)|\\[a-zA-Z]+(?:\{[^{}]*\})*)\b",
        lambda m: rf"^{{{m.group(1)}}}",
        s, flags=re.I,
    )

    # ── absolute value ────────────────────────────────────────────────────────
    s = re.sub(
        r"\bthe absolute value of\s+(.+?)(?=\s*(?:$|,))",
        lambda m: rf"|{alt_text_to_latex(m.group(1))}|",
        s, flags=re.I,
    )

    # ── function notation ─────────────────────────────────────────────────────
    # "f of (expr)" and "f of token" — matches any single letter (p, q, r, etc.)
    # Handle "f of negative X" before generic token capture
    s = re.sub(r"\b([a-zA-Z])\s+of\s+negative\s+(\S+)", r"\1(-\2)", s)
    s = re.sub(r"\b([a-zA-Z])\s+of\s+open parenthesis\s+(.+?)\s+close parenthesis", r"\1(\2)", s, flags=re.I)
    s = re.sub(r"\b([a-zA-Z])\s+of\s+\((.+?)\)", r"\1(\2)", s)
    s = re.sub(r"\b([a-zA-Z])\s+of\s+(\S+)",     r"\1(\2)", s)
    s = re.sub(r"\b([a-zA-Z])\s+inverse\s+of\s+(\S+)", r"\1^{-1}(\2)", s)

    # trig function "cosine of angle X" etc handled after trig substitution below

    # ── ordered pairs / coordinates ───────────────────────────────────────────
    def _coords(m: re.Match) -> str:
        x = alt_text_to_latex(m.group(1))
        y = alt_text_to_latex(m.group(2))
        return rf"({x}, {y})"

    s = re.sub(
        r"\bthe ordered pair\s+(.+?)\s+comma\s+(.+?)(?=\s*(?:$|,))",
        _coords, s, flags=re.I,
    )
    s = re.sub(
        r"\bwith coordinates\s+(.+?)\s+comma\s+(.+?)$",
        _coords, s, flags=re.I,
    )

    # ── angle and triangle notation ───────────────────────────────────────────
    # "angle A B C" → \angle ABC
    def _angle(m: re.Match) -> str:
        letters = re.sub(r"\s+", "", m.group(1))
        return rf"\angle {letters}"

    s = re.sub(r"\bangle\s+([A-Z](?:\s+[A-Z])*)\b", _angle, s)

    # "triangle A B C" → \triangle ABC
    def _triangle(m: re.Match) -> str:
        letters = re.sub(r"\s+", "", m.group(1))
        return rf"\triangle {letters}"

    s = re.sub(r"\btriangle\s+([A-Z](?:\s+[A-Z])*)\b", _triangle, s)

    # ── degrees ───────────────────────────────────────────────────────────────
    s = re.sub(r"\bdegrees?\b", r"^\\circ", s, flags=re.I)
    s = re.sub(r"\bdegrees Celsius\b",    r"^\\circ C",  s, flags=re.I)
    s = re.sub(r"\bdegrees Fahrenheit\b", r"^\\circ F",  s, flags=re.I)

    # ── operators ─────────────────────────────────────────────────────────────
    s = re.sub(r"\bplus or minus\b",  r"\\pm ", s, flags=re.I)
    s = re.sub(r"\bminus or plus\b",  r"\\mp ", s, flags=re.I)
    s = re.sub(r"\btimes\b",          r"\\times ", s, flags=re.I)
    s = re.sub(r"\bdivided by\b",     r"\\div ", s, flags=re.I)
    s = re.sub(r"\bplus\b",           "+",        s, flags=re.I)
    s = re.sub(r"\bminus\b",          "-",        s, flags=re.I)
    s = re.sub(r"\bnegative\b",       "-",        s, flags=re.I)

    # ── inequalities (longest phrases first) ──────────────────────────────────
    s = re.sub(r"\bis\s+not\s+equal\s+to\b",             r"\\neq ",  s, flags=re.I)
    s = re.sub(r"\bis\s+greater\s+than\s+or\s+equal\s+to\b", r"\\geq ", s, flags=re.I)
    s = re.sub(r"\bis\s+less\s+than\s+or\s+equal\s+to\b",    r"\\leq ", s, flags=re.I)
    s = re.sub(r"\bis\s+greater\s+than\b",               ">",        s, flags=re.I)
    s = re.sub(r"\bis\s+less\s+than\b",                  "<",        s, flags=re.I)
    s = re.sub(r"\bis\s+approximately\s+equal\s+to\b",   r"\\approx ", s, flags=re.I)
    s = re.sub(r"\bis\s+equal\s+to\b",                   "=",        s, flags=re.I)
    s = re.sub(r"\bis\s+not\s+equal\b",                  r"\\neq ",  s, flags=re.I)
    s = re.sub(r"\bnot\s+equal\s+to\b",                  r"\\neq ",  s, flags=re.I)
    s = re.sub(r"\bgreater\s+than\s+or\s+equal\s+to\b",  r"\\geq ",  s, flags=re.I)
    s = re.sub(r"\bless\s+than\s+or\s+equal\s+to\b",     r"\\leq ",  s, flags=re.I)
    s = re.sub(r"\bgreater\s+than\b",                    ">",        s, flags=re.I)
    s = re.sub(r"\bless\s+than\b",                       "<",        s, flags=re.I)
    s = re.sub(r"\bapproximately\s+equal\s+to\b",        r"\\approx ", s, flags=re.I)
    s = re.sub(r"\bequals?\b",                           "=",        s, flags=re.I)
    s = re.sub(r"\bnot equal\b",                         r"\\neq ",  s, flags=re.I)
    # bare "greater than" / "less than" not preceded by "is"
    s = re.sub(r"\bgreater\b", ">", s, flags=re.I)
    s = re.sub(r"\bless\b",    "<", s, flags=re.I)
    s = re.sub(r"\bwhich is approximately\b", r"\\approx", s, flags=re.I)
    s = re.sub(r"\bwhich =\b",  "=", s, flags=re.I)

    # ── Greek letters ─────────────────────────────────────────────────────────
    s = re.sub(r"\balpha\b",   r"\\alpha ",   s, flags=re.I)
    s = re.sub(r"\bbeta\b",    r"\\beta ",    s, flags=re.I)
    s = re.sub(r"\bgamma\b",   r"\\gamma ",   s, flags=re.I)
    s = re.sub(r"\bdelta\b",   r"\\delta ",   s, flags=re.I)
    s = re.sub(r"\bepsilon\b", r"\\epsilon ", s, flags=re.I)
    s = re.sub(r"\btheta\b",   r"\\theta ",   s, flags=re.I)
    s = re.sub(r"\blambda\b",  r"\\lambda ",  s, flags=re.I)
    s = re.sub(r"\bmu\b",      r"\\mu ",      s, flags=re.I)
    s = re.sub(r"\bpi\b",      r"\\pi ",      s, flags=re.I)
    s = re.sub(r"\bsigma\b",   r"\\sigma ",   s, flags=re.I)
    s = re.sub(r"\bphi\b",     r"\\phi ",     s, flags=re.I)
    s = re.sub(r"\bomega\b",   r"\\omega ",   s, flags=re.I)

    # ── special constants ─────────────────────────────────────────────────────
    s = re.sub(r"\binfinity\b", r"\\infty ", s, flags=re.I)

    # ── trig / log functions ──────────────────────────────────────────────────
    s = re.sub(r"\bsine\b",      r"\\sin",  s, flags=re.I)
    s = re.sub(r"\bcosine\b",    r"\\cos",  s, flags=re.I)
    s = re.sub(r"\btangent\b",   r"\\tan",  s, flags=re.I)
    s = re.sub(r"\bsecant\b",    r"\\sec",  s, flags=re.I)
    s = re.sub(r"\bcosecant\b",  r"\\csc",  s, flags=re.I)
    s = re.sub(r"\bcotangent\b", r"\\cot",  s, flags=re.I)
    s = re.sub(r"\bnatural log\b", r"\\ln", s, flags=re.I)
    s = re.sub(r"\blog base\s+(\S+)", r"\\log_{\1}", s, flags=re.I)
    s = re.sub(r"\blog\b",         r"\\log",  s, flags=re.I)

    # trig "of angle X" → drop "of angle" (angle already handled above)
    s = re.sub(r"\\(sin|cos|tan|sec|csc|cot)\s+of\s+", r"\\\1 ", s)

    # ── "comma" word → literal comma ─────────────────────────────────────────
    s = re.sub(r"\bcomma\b", ",", s, flags=re.I)

    # ── subscripts ────────────────────────────────────────────────────────────
    s = re.sub(r"\bsub(?:script)?\s+(\S+)", r"_{\1}", s, flags=re.I)
    s = re.sub(r"\bsuperscript\s+(\S+)",    r"^{\1}", s, flags=re.I)
    s = re.sub(r"\bsub(\w+)\b",             r"_{\1}", s)  # "subscript f" already gone

    # ── units / misc ──────────────────────────────────────────────────────────
    # Leave unit words (miles, meters, etc.) as-is — they render fine in math mode
    s = re.sub(r"\bwhich =\b", "=", s, flags=re.I)

    # ── clean whitespace ─────────────────────────────────────────────────────
    s = re.sub(r"\s{2,}", " ", s).strip()

    return s


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM-OF-EQUATIONS DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def _parse_system(alt: str) -> Optional[list[str]]:
    """
    Detect multi-equation alt texts (system of equations) and return
    a list of LaTeX strings, or None for single expressions.
    """
    stripped = alt.strip()

    # Format A: "open brace, eq1, and, eq2"
    if re.match(r"^open brace", stripped, re.I):
        body = re.sub(r"^open brace[,\s]*", "", stripped, flags=re.I)
        parts = re.split(r"\s*,\s*and\s*,\s*", body, flags=re.I)
        if len(parts) >= 2:
            return [alt_text_to_latex(p.strip()) for p in parts if p.strip()]

    # Format C: "Equation 1: ... Equation 2: ..."
    matches = list(re.finditer(r"Equation\s+\d+:\s*(.+?)(?=Equation\s+\d+:|$)", stripped, re.I))
    if len(matches) >= 2:
        return [alt_text_to_latex(m.group(1).strip()) for m in matches]

    return None


def _build_stack(equations: list[str]) -> str:
    """Return a block-display system-of-equations HTML."""
    lines = "".join(
        f'<span style="display:block;">\\({eq}\\)</span>'
        for eq in equations
    )
    return f'<div class="math-system" style="display:flex;flex-direction:column;gap:0.2em;">{lines}</div>'


# ─────────────────────────────────────────────────────────────────────────────
# HTML PROCESSOR
# ─────────────────────────────────────────────────────────────────────────────

def process_html(html: str, cache: dict[str, str]) -> tuple[str, int, int]:
    """
    Process a single HTML string:
    - Replace math-img tags with LaTeX spans
    - Fix real image sizing
    Returns (new_html, math_replaced, images_fixed).
    """
    if not html:
        return html, 0, 0

    if "math-img" not in html and "math_img" not in html and "<img" not in html:
        return html, 0, 0

    soup = BeautifulSoup(f"<div>{html}</div>", "html.parser")
    wrapper = soup.find("div")
    math_replaced = 0
    images_fixed  = 0

    # ── Step 1: math images ───────────────────────────────────────────────────
    for img in wrapper.find_all("img"):
        cls = " ".join(img.get("class", []))
        if "math-img" not in cls and "math_img" not in cls:
            continue

        alt = (img.get("alt") or "").strip()
        if not alt:
            img.decompose()
            continue

        # System of equations?
        eqs = _parse_system(alt)
        if eqs and len(eqs) >= 2:
            replacement = BeautifulSoup(_build_stack(eqs), "html.parser")
            container = (
                img.find_parent(class_=["math_expression", "math-container"])
                or img.parent
            )
            container.replace_with(replacement)
            math_replaced += 1
            continue

        # Single expression
        latex = cache.get(alt) or alt_text_to_latex(alt)
        if not latex:
            img.decompose()
            continue

        span = soup.new_tag("span", attrs={"class": "math-inline"})
        span.string = f"\\({latex}\\)"

        container = (
            img.find_parent(class_=["math_expression", "math-container"])
            or img.parent
        )
        # Replace container only if it contains just this image
        container_text = (container.get_text() or "").replace(" ", "")
        alt_text_clean = alt.replace(" ", "")
        if container is not wrapper and container_text == alt_text_clean:
            container.replace_with(span)
        else:
            img.replace_with(span)

        math_replaced += 1

    # ── Step 2: real image sizing ─────────────────────────────────────────────
    for img in wrapper.find_all("img"):
        cls = " ".join(img.get("class", []))
        if "math-img" in cls or "math_img" in cls:
            continue  # should be gone already, but guard

        changed = False
        for attr in ("width", "height"):
            if img.has_attr(attr):
                del img[attr]
                changed = True

        existing_style = img.get("style", "")
        if "max-width" not in existing_style:
            img["style"] = (existing_style.rstrip(";") + ";max-width:100%;height:auto;").lstrip(";")
            changed = True

        if changed:
            images_fixed += 1

    return str(wrapper)[5:-6], math_replaced, images_fixed  # strip outer <div>…</div>


# ─────────────────────────────────────────────────────────────────────────────
# CACHE BUILD
# ─────────────────────────────────────────────────────────────────────────────

def build_cache(force: bool = False) -> dict[str, str]:
    """
    Build (or load) the alt→latex translation cache.
    Existing cache entries are kept; new ones are added.
    """
    cache: dict[str, str] = {}
    if CACHE_FILE.exists() and not force:
        cache = json.loads(CACHE_FILE.read_text())
        print(f"Loaded {len(cache)} existing cache entries from {CACHE_FILE.name}")

    if not ALTS_FILE.exists():
        print(f"No alts file found at {ALTS_FILE}. Run the extraction step first.")
        return cache

    alts: list[str] = json.loads(ALTS_FILE.read_text())
    new_count = 0
    for alt in alts:
        if alt not in cache:
            eqs = _parse_system(alt)
            if eqs and len(eqs) >= 2:
                # System — store the stack HTML directly under a special key
                cache[alt] = "__system__"
            else:
                cache[alt] = alt_text_to_latex(alt)
            new_count += 1

    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False))
    print(f"Cache: {len(cache)} total entries ({new_count} new). Saved to {CACHE_FILE.name}")
    return cache


# ─────────────────────────────────────────────────────────────────────────────
# CHECK MODE
# ─────────────────────────────────────────────────────────────────────────────

def check_db() -> None:
    """Count remaining math-img tags in the DB."""
    db = SessionLocal()
    try:
        questions = db.query(Question).filter(Question.is_active == True).all()
        remaining = 0
        total = 0
        for q in questions:
            total += 1
            for field in [q.prompt_html or "", q.explanation_html or ""]:
                if "math-img" in field or "math_img" in field:
                    remaining += 1
                    break
            choices = q.choices_json or []
            for c in choices:
                if "math-img" in (c or "") or "math_img" in (c or ""):
                    remaining += 1
                    break

        print(f"Total active questions : {total}")
        print(f"Questions with math-img: {remaining}")
        print(f"Questions clean        : {total - remaining}")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# MAIN MIGRATION
# ─────────────────────────────────────────────────────────────────────────────

def run_migration(dry_run: bool = False, limit: Optional[int] = None) -> None:
    cache = build_cache()

    db = SessionLocal()
    try:
        query = db.query(Question).filter(Question.is_active == True)
        if limit:
            query = query.limit(limit)
        questions = query.all()

        total        = len(questions)
        updated      = 0
        math_total   = 0
        images_total = 0
        skipped      = 0

        print(f"\nProcessing {total} questions (dry_run={dry_run})…\n")

        for i, q in enumerate(questions, 1):
            changed = False

            # prompt_html
            new_prompt, m, img = process_html(q.prompt_html or "", cache)
            if new_prompt != (q.prompt_html or ""):
                math_total   += m
                images_total += img
                if not dry_run:
                    q.prompt_html = new_prompt
                changed = True

            # choices_json
            if q.choices_json:
                new_choices = []
                choices_changed = False
                for choice in q.choices_json:
                    new_c, m, img = process_html(choice or "", cache)
                    math_total   += m
                    images_total += img
                    if new_c != (choice or ""):
                        choices_changed = True
                    new_choices.append(new_c)
                if choices_changed:
                    if not dry_run:
                        q.choices_json = new_choices
                    changed = True

            # explanation_html
            new_exp, m, img = process_html(q.explanation_html or "", cache)
            if new_exp != (q.explanation_html or ""):
                math_total   += m
                images_total += img
                if not dry_run:
                    q.explanation_html = new_exp
                changed = True

            if changed:
                updated += 1
                if not dry_run and updated % 100 == 0:
                    db.commit()
                    print(f"  {i}/{total}  committed {updated} so far…")
            else:
                skipped += 1

        if not dry_run:
            db.commit()

        print(f"\n{'[DRY RUN] ' if dry_run else ''}Done.")
        print(f"  Questions updated       : {updated}")
        print(f"  Questions already clean : {skipped}")
        print(f"  Math img tags replaced  : {math_total}")
        print(f"  Real images sized       : {images_total}")

    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# REPATCH — fix known bad LaTeX from previous migration run
# ─────────────────────────────────────────────────────────────────────────────

# Mapping: bad exponent string (inside ^{...}) → correct integer
_BAD_EXPONENTS: dict[str, int] = {
    "fif": 5, "four": 4, "six": 6, "eigh": 8, "nin": 9,
    "fourteen": 14, "seven": 7, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fifteen": 15, "sixteen": 16, "seventeen": 17,
    "eighteen": 18, "nineteen": 19, "twenty": 20,
    # Full ordinal words that were stored without stripping
    "fifth": 5, "fourth": 4, "sixth": 6, "eighth": 8, "ninth": 9,
    "seventh": 7, "eleventh": 11, "twelfth": 12, "fourteenth": 14,
}


def repatch_html(html: str) -> tuple[str, int]:
    """
    Apply targeted text fixes to already-migrated HTML with known LaTeX bugs:
      1. Ordinal exponents stored as word-form (^{fif} → ^{5}, etc.)
      2. '^{of} \\frac{...}' → '^{\\frac{...}}' (to the power of the fraction bug)
      3. Single-letter function notation not converted (p of x → p(x))
    Returns (patched_html, number_of_changes).
    """
    if not html:
        return html, 0

    changes = [0]  # list so inner lambdas can mutate

    def bump(new, old):
        if new != old:
            changes[0] += 1
        return new

    # Fix 1: Ordinal exponents — ^{fif} → ^{5} etc.
    for bad_word, num in _BAD_EXPONENTS.items():
        needle = f"^{{{bad_word}}}"
        if needle in html:
            html = html.replace(needle, f"^{{{num}}}")
            changes[0] += 1

    # Fix 2: "^{of} \frac{...}{...}" → "^{\frac{...}{...}}"
    # Handles "to the power of the fraction q over 4" conversion artifact
    new = re.sub(
        r'\^\{of\}\s*(\\frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\})',
        r'^{\1}',
        html,
    )
    html = bump(new, html)

    # Fix 3: Single-letter function notation not converted inside \(...\) spans
    # e.g. \(p of x = ...\) → \(p(x) = ...\)
    def _fix_func(m: re.Match) -> str:
        inner = m.group(1)
        fixed = re.sub(r'\b([a-zA-Z])\s+of\s+(-?\S+)', r'\1(\2)', inner)
        if fixed != inner:
            changes[0] += 1
        return f'\\({fixed}\\)'

    html = re.sub(r'\\\((.+?)\\\)', _fix_func, html, flags=re.DOTALL)

    return html, changes[0]


def run_repatch(dry_run: bool = False) -> None:
    """Scan all questions and apply repatch_html fixes."""
    db = SessionLocal()
    try:
        questions = db.query(Question).filter(Question.is_active == True).all()
        total = len(questions)
        updated = 0

        print(f"\nRepatching {total} questions (dry_run={dry_run})…\n")

        for i, q in enumerate(questions, 1):
            changed = False

            for attr in ("prompt_html", "explanation_html"):
                original = getattr(q, attr) or ""
                patched, n = repatch_html(original)
                if patched != original:
                    if not dry_run:
                        setattr(q, attr, patched)
                    changed = True

            if q.choices_json:
                new_choices = []
                choices_changed = False
                for choice in q.choices_json:
                    patched, n = repatch_html(choice or "")
                    if patched != (choice or ""):
                        choices_changed = True
                    new_choices.append(patched)
                if choices_changed:
                    if not dry_run:
                        q.choices_json = new_choices
                    changed = True

            if changed:
                updated += 1
                if not dry_run and updated % 100 == 0:
                    db.commit()
                    print(f"  {i}/{total}  committed {updated} so far…")

        if not dry_run:
            db.commit()

        print(f"\n{'[DRY RUN] ' if dry_run else ''}Repatch done.")
        print(f"  Questions updated : {updated}")
        print(f"  Questions clean   : {total - updated}")

    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Normalize question HTML (Phase 1)")
    ap.add_argument("--cache-only", action="store_true",
                    help="Build/update translation cache only; no DB writes")
    ap.add_argument("--dry-run",    action="store_true",
                    help="Show what would change without writing to DB")
    ap.add_argument("--limit",      type=int, default=None,
                    help="Only process N questions (for testing)")
    ap.add_argument("--check",      action="store_true",
                    help="Count remaining math-img tags in DB")
    ap.add_argument("--force-cache", action="store_true",
                    help="Rebuild cache from scratch")
    ap.add_argument("--repatch", action="store_true",
                    help="Fix known bad LaTeX from previous migration (ordinals, function notation)")
    args = ap.parse_args()

    if args.check:
        check_db()
    elif args.cache_only or args.force_cache:
        build_cache(force=args.force_cache)
    elif args.repatch:
        run_repatch(dry_run=args.dry_run)
    else:
        run_migration(dry_run=args.dry_run, limit=args.limit)
