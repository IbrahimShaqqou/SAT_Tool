"""
Deterministic question-content extraction from the College Board source files
(math_core.json / math_norm.json).

The source already contains exact, structured MathML for most math questions, so
we render it DIRECTLY (MathJax handles MathML) instead of reconstructing math
from the human-readable `alttext`. No AI, no prose-parsing — that reconstruction
is what introduced rendering errors (spurious ×, bad fractions).

Two source content shapes are handled:
  - dict-content: {type, stem, answerOptions|keys, rationale, correct_answer}
  - list-content: [{prompt, answer:{style, choices}, ...}]  (already clean HTML)

Pure functions only — no DB, no I/O. See
docs/superpowers/specs/2026-06-14-deterministic-math-reimport-design.md.
"""

import html
import re
from typing import Optional

MATHML_NS = "http://www.w3.org/1998/Math/MathML"
_LETTERS = ["A", "B", "C", "D", "E", "F"]


def clean_html(s: Optional[str]) -> str:
    """
    Light, deterministic cleanup. MathML structure is preserved verbatim.
      - decode stray HTML entities that break rendering (&gt;, &#62;, &amp; → real chars)
      - ensure <math> elements carry the MathML xmlns
      - collapse empty paragraphs and runaway whitespace
    """
    if not s:
        return ""
    out = s

    # Decode entities that appear as literal text inside content (e.g. "x &gt; 3").
    # html.unescape is safe here: the source stores real tags as tags, and these
    # entities as the math/text operators they represent.
    out = html.unescape(out)

    # Ensure every <math ...> has an xmlns (some source entries omit it). Only add
    # when missing; never duplicate.
    def _add_ns(m: re.Match) -> str:
        tag = m.group(0)
        if "xmlns" in tag:
            return tag
        return tag[:-1] + f' xmlns="{MATHML_NS}">' if tag.endswith(">") else tag
    out = re.sub(r"<math\b[^>]*>", _add_ns, out)

    # Normalize whitespace: drop empty <p></p>, collapse 3+ newlines, trim.
    out = re.sub(r"<p[^>]*>\s*</p>", "", out)
    out = re.sub(r"[ \t]+\n", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _extract_dict(content: dict) -> dict:
    """dict-content: native MathML stem/answerOptions/rationale."""
    qtype = (content.get("type") or "").lower()
    prompt_html = clean_html(content.get("stem"))
    explanation_html = clean_html(content.get("rationale"))

    if qtype == "mcq":
        options = content.get("answerOptions") or []
        choices = [clean_html(o.get("content")) for o in options]
        # Correct index: match the key id to an option id; fall back to the
        # letter in correct_answer (e.g. ["C"] -> index 2).
        idx = None
        keys = content.get("keys") or []
        if keys:
            ids = [o.get("id") for o in options]
            if keys[0] in ids:
                idx = ids.index(keys[0])
        if idx is None:
            ca = content.get("correct_answer") or []
            if ca and isinstance(ca[0], str) and ca[0].upper() in _LETTERS:
                idx = _LETTERS.index(ca[0].upper())
        correct = {"index": idx if idx is not None else 0}
        answer_type = "MCQ"
    else:  # spr (student-produced response)
        choices = []
        answers = content.get("keys") or content.get("correct_answer") or []
        correct = {"answers": [str(a) for a in answers]}
        answer_type = "SPR"

    return {
        "prompt_html": prompt_html,
        "choices_json": choices,
        "correct_answer_json": correct,
        "explanation_html": explanation_html,
        "answer_type": answer_type,
    }


def _extract_list(content: list) -> dict:
    """list-content: already-clean HTML prompt + answer.choices."""
    entry = content[0] if content else {}
    prompt_html = clean_html(entry.get("prompt"))
    explanation_html = clean_html(entry.get("rationale") or entry.get("explanation"))
    answer = entry.get("answer") or {}
    style = (answer.get("style") or "").lower()

    if "multiple" in style or answer.get("choices"):
        raw = answer.get("choices") or {}
        # choices is a dict keyed by letter: {"a": {"body": "..."}, ...}
        ordered = sorted(raw.items()) if isinstance(raw, dict) else list(enumerate(raw))
        choices = [clean_html((v or {}).get("body") if isinstance(v, dict) else v) for _, v in ordered]
        correct_letter = str(
            answer.get("correct_choice") or answer.get("correct") or answer.get("key") or ""
        ).lower()
        keys = [str(k).lower() for k, _ in ordered]
        idx = keys.index(correct_letter) if correct_letter in keys else 0
        return {
            "prompt_html": prompt_html, "choices_json": choices,
            "correct_answer_json": {"index": idx},
            "explanation_html": explanation_html, "answer_type": "MCQ",
        }
    # SPR
    ans = answer.get("value") or answer.get("answers") or answer.get("correct") or []
    if isinstance(ans, (str, int, float)):
        ans = [str(ans)]
    return {
        "prompt_html": prompt_html, "choices_json": [],
        "correct_answer_json": {"answers": [str(a) for a in ans]},
        "explanation_html": explanation_html, "answer_type": "SPR",
    }


def extract_from_source(source_entry: dict) -> Optional[dict]:
    """
    Given one source question (a value from math_core.json), return the renderable
    fields {prompt_html, choices_json, correct_answer_json, explanation_html,
    answer_type}, or None if the entry has no usable content.
    """
    content = source_entry.get("content")
    if isinstance(content, dict):
        result = _extract_dict(content)
    elif isinstance(content, list):
        result = _extract_list(content)
    else:
        return None
    if not result.get("prompt_html"):
        return None
    return result
