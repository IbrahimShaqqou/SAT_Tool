"""
Tests for deterministic question-content extraction (math re-import).

Uses REAL entries from data/math_core.json so we verify against actual College
Board source, not synthetic fixtures. The core guarantee: MathML structure is
preserved verbatim — we never re-interpret math (which is what introduced the
spurious-× class of errors).
"""

import json
import re
from pathlib import Path

import pytest

from app.services.question_content import extract_from_source, clean_html, MATHML_NS

SOURCE = Path(__file__).parent.parent / "data" / "math_core.json"


@pytest.fixture(scope="module")
def source():
    return json.loads(SOURCE.read_text())


def _by_type(source, want_type, content_is_list=False):
    for q in source.values():
        c = q.get("content")
        if content_is_list and isinstance(c, list):
            return q
        if not content_is_list and isinstance(c, dict) and (c.get("type") or "").lower() == want_type:
            return q
    return None


# --------------------------- cleanup is non-destructive to MathML --------------------------- #
def test_clean_html_preserves_mathml_structure():
    src = '<p><math alttext="x"><mfrac><mn>12</mn><mn>4</mn></mfrac><mo>+</mo><mi>x</mi></math></p>'
    out = clean_html(src)
    # Every structural element survives, in order.
    for tag in ("<mfrac>", "<mn>12</mn>", "<mn>4</mn>", "<mo>+</mo>", "<mi>x</mi>"):
        assert tag in out
    # No operator was invented (the × bug).
    assert "×" not in out and "\\times" not in out and "*" not in out


def test_clean_html_adds_xmlns_when_missing():
    out = clean_html('<math alttext="x"><mi>x</mi></math>')
    assert MATHML_NS in out


def test_clean_html_does_not_duplicate_xmlns():
    src = f'<math xmlns="{MATHML_NS}" alttext="x"><mi>x</mi></math>'
    out = clean_html(src)
    assert out.count("xmlns") == 1


def test_clean_html_decodes_entities():
    out = clean_html("<p>x &gt; 3 and y &#62; 0</p>")
    assert ">" in out and "&gt;" not in out and "&#62;" not in out


# --------------------------- extraction on real data --------------------------- #
def test_real_spr_extraction(source):
    q = _by_type(source, "spr")
    assert q is not None
    r = extract_from_source(q)
    assert r["answer_type"] == "SPR"
    assert r["choices_json"] == []
    assert isinstance(r["correct_answer_json"].get("answers"), list)
    assert r["correct_answer_json"]["answers"]  # non-empty


def test_real_mcq_extraction(source):
    q = _by_type(source, "mcq")
    assert q is not None
    r = extract_from_source(q)
    assert r["answer_type"] == "MCQ"
    assert len(r["choices_json"]) >= 2
    idx = r["correct_answer_json"]["index"]
    assert 0 <= idx < len(r["choices_json"])


def test_list_content_correct_index(source):
    q = _by_type(source, None, content_is_list=True)
    assert q is not None
    entry = q["content"][0]
    answer = entry.get("answer", {})
    if answer.get("style", "").lower().startswith("multiple"):
        r = extract_from_source(q)
        # The correct index must point at the option matching `correct_choice`.
        letters = sorted((answer.get("choices") or {}).keys())
        expected = letters.index(str(answer["correct_choice"]).lower())
        assert r["correct_answer_json"]["index"] == expected


def test_every_extracted_prompt_is_nonempty_and_math_balanced(source):
    # Sweep a chunk of real questions: every <math> open has a close.
    checked = 0
    for q in list(source.values())[:300]:
        r = extract_from_source(q)
        if not r:
            continue
        checked += 1
        p = r["prompt_html"]
        assert p.strip()
        assert p.count("<math") == p.count("</math>"), f"unbalanced math in {q.get('external_id')}"
    assert checked > 100  # we actually exercised real data


def test_no_spurious_multiplication_introduced(source):
    # Compare alttext (which never contains a literal ×) to the rendered MathML:
    # the only <mo>×</mo> we keep are ones the SOURCE actually has.
    for q in list(source.values())[:200]:
        c = q.get("content")
        if not isinstance(c, dict):
            continue
        stem = c.get("stem") or ""
        r = extract_from_source(q)
        if not r:
            continue
        # If the source stem had no × / &#215; / ×, the output must not either.
        if "×" not in stem and "&#215;" not in stem and "×" not in stem:
            assert "×" not in r["prompt_html"]
