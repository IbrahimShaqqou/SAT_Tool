#!/usr/bin/env python3
"""
generate_explanations.py
------------------------
Generates step-by-step explanations for SAT questions using Gemini 2.5 Flash.

Supports three question types:
  - math       : Steps with optional Desmos graph (uses x/y variables only)
  - reading    : Steps with text highlights (passage evidence, question anchors)
  - grammar    : Steps naming grammar rules, highlights for error/correction

Usage:
    cd backend/
    GEMINI_API_KEY=... python -m scripts.generate_explanations --type math --limit 3
    GEMINI_API_KEY=... python -m scripts.generate_explanations --type math --apply
    GEMINI_API_KEY=... python -m scripts.generate_explanations --apply
    GEMINI_API_KEY=... python -m scripts.generate_explanations --force --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Optional

from google import genai
from google.genai import types as gtypes

DATA_DIR = Path(__file__).parent.parent / "data"
PREVIEW_FILE = DATA_DIR / "explanations_preview.json"
PROGRESS_FILE = DATA_DIR / "explanation_progress.json"

MODEL = "gemini-2.5-flash"

# ─────────────────────────────────────────────────────────────────────────────
# Claude System Prompts
# ─────────────────────────────────────────────────────────────────────────────

MATH_SYSTEM = """You are an expert SAT math tutor generating a step-by-step explanation JSON.

Rules:
1. Return ONLY valid JSON — no markdown fences, no extra text.
2. 3–5 steps. Titles are short active-voice phrases. Build toward the answer — don't reveal it in step 1.
3. Content uses markdown with inline $LaTeX$ or display $$LaTeX$$. No \\( \\) delimiters.
4. desmos: STRONGLY ENCOURAGED whenever a visual would help — err on the side of including it. Use it for:
   - Any graph of a function (linear, quadratic, exponential, trig, absolute value, piecewise)
   - Systems of equations (show the intersection point)
   - Inequalities (shade the feasible region using y < ... or y > ...)
   - Scatter plots with a line/curve of best fit (use a table + regression)
   - Geometry: circles (x^2 + y^2 = r^2), triangles, angles — plot the key points
   - Any problem where plotting the answer choices helps compare them visually
   - Data/statistics: if a table of values is given, plot them in Desmos using a table

   Desmos table syntax (for scatter plots and data): use "table" as a special equation string:
   {"equations": ["table:x1,y1;x2,y2;x3,y3", "y = 2*x + 1"], ...}
   Example scatter plot with regression line: ["table:1,3;2,5;3,8;4,10", "y = 2.3*x + 0.5"]

   Other rules:
   - Use ONLY x and y variables in equations — remap all other variables: first variable → x, second → y.
   - Set bounds so the key feature (intersection, vertex, root, data range) is clearly visible with padding.
   - Write a concrete, interactive hint (e.g. "Drag the point on the line to see how slope changes.", "Click the intersection to read the solution.", "Notice where the parabola crosses the x-axis.").
   - Only skip desmos for pure arithmetic, unit conversions, or probability questions with no graph.
5. key_insight: one sentence naming the core concept or the most common student mistake.
6. why_wrong: explain the error logic for each wrong choice label. Omit the correct answer label. Use empty [] for SPR questions.

JSON schema:
{
  "type": "math",
  "steps": [
    {
      "title": "Short active-voice title",
      "content": "Markdown with $inline$ or $$display$$ math",
      "desmos": {
        "equations": ["y = 2*x + 1", "y = -x + 4"],
        "x_min": -5, "x_max": 10, "y_min": -3, "y_max": 12,
        "hint": "Click the intersection point to read off the solution."
      }
    }
  ],
  "key_insight": "One sentence.",
  "why_wrong": [
    {"label": "A", "reason": "Why this choice is wrong."}
  ]
}"""

READING_SYSTEM = """You are an expert SAT Reading & Writing tutor generating a step-by-step explanation JSON.

Rules:
1. Return ONLY valid JSON — no markdown fences, no extra text.
2. 3–4 steps. Typical flow: (1) Understand what the question is asking, (2) Find relevant passage evidence, (3) Evaluate the answer choices, (4) Confirm with text support.
3. Content is markdown prose. No LaTeX, no desmos.
4. highlights: Mark EXACT verbatim substrings from the source text. The "text" field MUST appear word-for-word in the location you specify — even one word off will break highlighting. Color semantics:
   - yellow = key evidence in passage
   - blue = question anchor phrase (from the question text itself)
   - green = language matching or supporting the correct answer
   - red = trap/distractor signal
5. key_insight: one sentence on the reading strategy or common trap (e.g. "The correct answer must be explicitly supported by the passage text — not merely consistent with it.").
6. why_wrong: cite specific passage logic or evidence for each wrong choice label.

JSON schema:
{
  "type": "reading",
  "steps": [
    {
      "title": "Short active-voice title",
      "content": "Markdown prose.",
      "highlights": [
        {"text": "exact verbatim substring", "color": "yellow", "location": "passage"},
        {"text": "exact phrase", "color": "blue", "location": "question"}
      ]
    }
  ],
  "key_insight": "One sentence.",
  "why_wrong": [
    {"label": "A", "reason": "Specific reason this choice is wrong."}
  ]
}"""

GRAMMAR_SYSTEM = """You are an SAT grammar tutor generating a step-by-step explanation JSON. Write like a helpful teacher, not a textbook — keep the language simple and direct. Avoid grammatical jargon unless it's truly necessary. Students should feel like they're getting a clear, practical tip, not a lecture.

Rules:
1. Return ONLY valid JSON — no markdown fences, no extra text.
2. 3–4 steps. Practical flow: (1) Find the blank and look at what comes before and after it, (2) Check whether what's on each side is a complete thought or not, (3) Use that to pick the right punctuation or word.
3. For punctuation questions: tell students to literally read what's before and after the punctuation mark. Ask: is it a complete sentence on its own? That tells you whether you need a period, semicolon, comma, or nothing. Use plain terms like "complete thought" instead of "independent clause."
4. Content is markdown prose. No LaTeX, no desmos.
5. highlights: Mark EXACT verbatim substrings. The "text" field MUST appear word-for-word in the location you specify. Color semantics:
   - red = the part of the sentence that signals a problem
   - green = correct form (in the correct answer choice)
   - yellow = the key phrase to focus on
   - blue = structural signal (e.g. a list, a connecting word)
6. key_insight: one plain-English tip a student can actually remember and use next time (e.g. "If both sides of the punctuation are complete thoughts, you can use a period or semicolon — but not just a comma.").
7. why_wrong: explain in plain English why each wrong choice doesn't work — focus on what it does to the sentence, not what rule it violates.

JSON schema:
{
  "type": "grammar",
  "steps": [
    {
      "title": "Short active-voice title",
      "content": "Plain-English prose. Check what comes before and after.",
      "highlights": [
        {"text": "exact verbatim text", "color": "red", "location": "passage"},
        {"text": "correct form", "color": "green", "location": "choice_a"}
      ]
    }
  ],
  "key_insight": "One plain-English tip the student can use next time.",
  "why_wrong": [
    {"label": "B", "reason": "Plain-English explanation of why this doesn't work."}
  ]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# Type detection
# ─────────────────────────────────────────────────────────────────────────────

def get_question_type(question) -> str:
    """Determine math/reading/grammar from question model."""
    from app.models.enums import SubjectArea
    if question.subject_area == SubjectArea.MATH:
        return "math"
    # Reading & Writing: check domain code for SEC (Standard English Conventions)
    domain_code = question.domain.code if question.domain else ""
    return "grammar" if domain_code == "SEC" else "reading"


# ─────────────────────────────────────────────────────────────────────────────
# HTML → plain text helpers
# ─────────────────────────────────────────────────────────────────────────────

def strip_html(html: str) -> str:
    """Very simple HTML stripper — removes tags, decodes basic entities.
    Preserves <img alt="..."> text so image-choice questions aren't blank."""
    if not html:
        return ""
    # Replace <img ...alt="DESC"...> with the alt text before stripping
    text = re.sub(r'<img[^>]*\balt=["\']([^"\']*)["\'][^>]*>', r'\1', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>') \
               .replace('&nbsp;', ' ').replace('&#39;', "'").replace('&quot;', '"')
    return re.sub(r'\s+', ' ', text).strip()


def choices_to_plain(choices_json) -> dict[str, str]:
    """Return {A: text, B: text, C: text, D: text} from choices_json."""
    if not choices_json:
        return {}
    labels = "ABCDEFGH"
    result = {}
    for i, c in enumerate(choices_json):
        if i >= len(labels):
            break
        text = ""
        if isinstance(c, str):
            text = c
        elif isinstance(c, dict):
            text = c.get("content") or c.get("html") or c.get("text") or ""
        result[labels[i]] = strip_html(text)
    return result


def correct_label(question) -> str:
    """Return the label letter of the correct answer for MCQ."""
    ca = question.correct_answer_json
    if isinstance(ca, dict):
        idx = ca.get("index")
        if idx is not None:
            return "ABCDEFGH"[int(idx)]
    return ""


# ─────────────────────────────────────────────────────────────────────────────
# Validation helpers
# ─────────────────────────────────────────────────────────────────────────────

def validate_highlights(steps: list[dict], question) -> list[dict]:
    """
    Drop any highlight whose 'text' is not a verbatim substring of the
    specified location source. This prevents phantom highlights.
    """
    # Build location map
    passage = strip_html(question.prompt_html or "")
    # For reading questions, prompt_html may contain the passage; we use the full prompt
    location_map: dict[str, str] = {
        "passage": passage,
        "question": passage,  # question text is embedded in prompt_html
    }
    choices = choices_to_plain(question.choices_json)
    for label, text in choices.items():
        key = f"choice_{label.lower()}"
        location_map[key] = text

    for step in steps:
        valid_highlights = []
        for h in step.get("highlights") or []:
            loc = h.get("location", "")
            source = location_map.get(loc, "")
            if h.get("text") and h["text"] in source:
                valid_highlights.append(h)
        step["highlights"] = valid_highlights if valid_highlights else None

    return steps


def validate_desmos(steps: list[dict]) -> list[dict]:
    """
    Ensure desmos equations only use x and y variables.
    Remove desmos block if any equation uses other single-letter variables.
    """
    for step in steps:
        desmos = step.get("desmos")
        if not desmos:
            continue
        equations = desmos.get("equations") or []
        bad = False
        for eq in equations:
            # Find all single-letter variables (not part of longer word, not x/y)
            vars_found = set(re.findall(r'(?<![a-zA-Z])([a-zA-Z])(?![a-zA-Z])', eq))
            bad_vars = vars_found - {'x', 'y', 'e'}  # e is Euler's number
            if bad_vars:
                bad = True
                break
        if bad:
            step["desmos"] = None
    return steps


# ─────────────────────────────────────────────────────────────────────────────
# Build user message for Claude
# ─────────────────────────────────────────────────────────────────────────────

def build_user_message(question, qtype: str) -> str:
    """Format question content into a Claude user message."""
    parts = []
    parts.append(f"QUESTION TYPE: {qtype}")
    parts.append(f"DIFFICULTY: {question.difficulty.value if question.difficulty else 'unknown'}")
    parts.append(f"\nQUESTION HTML:\n{question.prompt_html or ''}")

    if question.choices_json:
        choices = choices_to_plain(question.choices_json)
        parts.append("\nANSWER CHOICES:")
        for label, text in choices.items():
            parts.append(f"  {label}: {text}")
        clabel = correct_label(question)
        if clabel:
            parts.append(f"\nCORRECT ANSWER: {clabel}")
    else:
        # SPR
        ca = question.correct_answer_json
        answers = ca.get("answers", []) if isinstance(ca, dict) else []
        parts.append(f"\nCORRECT ANSWER (SPR): {', '.join(str(a) for a in answers)}")

    if question.explanation_html:
        parts.append(f"\nCOLLEGE BOARD RATIONALE (use as reference, do not copy verbatim):\n{strip_html(question.explanation_html)}")

    return "\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Call Claude
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "math": MATH_SYSTEM,
    "reading": READING_SYSTEM,
    "grammar": GRAMMAR_SYSTEM,
}


def _repair_json_latex(raw: str) -> str:
    """
    Fix unescaped LaTeX backslashes inside JSON string values.
    Gemini sometimes outputs \\frac, \\left etc. as single backslashes
    which are invalid JSON. Walks char-by-char to only fix inside strings.
    """
    out = []
    i = 0
    in_string = False

    while i < len(raw):
        c = raw[i]
        if not in_string:
            out.append(c)
            if c == '"':
                in_string = True
            i += 1
        else:
            if c == '"':
                # Unescaped quote → end of string
                out.append(c)
                in_string = False
                i += 1
            elif c == '\\':
                if i + 1 >= len(raw):
                    out.append('\\\\')
                    i += 1
                    continue
                nc = raw[i + 1]
                if nc in ('"', '\\', '/', 'n', 'r', 't'):
                    # Unambiguously valid JSON escapes
                    out.append(c); out.append(nc)
                    i += 2
                elif nc == 'u' and i + 5 < len(raw) and all(
                        x in '0123456789abcdefABCDEF' for x in raw[i+2:i+6]):
                    # \uXXXX unicode escape
                    out.append(raw[i:i+6])
                    i += 6
                elif nc == 'f' and i + 2 < len(raw) and raw[i + 2].isalpha():
                    # \frac, \forall etc. — LaTeX, not JSON \f (formfeed)
                    out.append('\\\\')
                    i += 1
                elif nc in ('b', 'f'):
                    # \b (backspace) or \f (formfeed) — valid JSON, keep
                    out.append(c); out.append(nc)
                    i += 2
                else:
                    # Any other \X → LaTeX command, escape it
                    out.append('\\\\')
                    i += 1
            else:
                out.append(c)
                i += 1

    return ''.join(out)


def generate_explanation(client: genai.Client, question, qtype: str) -> dict | None:
    """Call Gemini 2.5 Flash to generate a step-by-step explanation. Returns parsed dict or None."""
    system = SYSTEM_PROMPTS[qtype]
    user_msg = build_user_message(question, qtype)

    for attempt in range(5):
        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=user_msg,
                config=gtypes.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    max_output_tokens=8192,
                    temperature=0.4,
                    thinking_config=gtypes.ThinkingConfig(thinking_budget=0),
                ),
            )
            raw = resp.text.strip() if resp.text else ""
            if not raw:
                raise Exception("Empty response from API")

            # Strip markdown fences if model added them anyway
            if raw.startswith("```"):
                raw = re.sub(r'^```[a-z]*\n?', '', raw)
                raw = re.sub(r'\n?```$', '', raw)

            # Try parsing; if it fails, repair LaTeX backslashes and retry
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = json.loads(_repair_json_latex(raw))

            # Post-process
            if "steps" in data:
                data["steps"] = validate_highlights(data["steps"], question)
                data["steps"] = validate_desmos(data["steps"])

            # Remove why_wrong entry for correct answer label
            clabel = correct_label(question)
            if clabel and "why_wrong" in data:
                data["why_wrong"] = [
                    w for w in data["why_wrong"]
                    if w.get("label") != clabel
                ]

            return data

        except json.JSONDecodeError as e:
            if attempt < 4:
                time.sleep(2 ** attempt)
            else:
                print(f"  JSON parse error for {question.id}: {e}")
                return None
        except Exception as e:
            err = str(e)
            wait = 2 ** attempt
            if "429" in err or "quota" in err.lower() or "rate" in err.lower() or "resource_exhausted" in err.lower():
                wait = max(wait, 30)
            if attempt < 4:
                time.sleep(wait)
            else:
                print(f"  API error for {question.id}: {e}")
                return None

    return None


# ─────────────────────────────────────────────────────────────────────────────
# DB helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_db(qtype: Optional[str], skill_code: Optional[str], limit: Optional[int],
            force: bool) -> list:
    """Load questions from DB filtered by type/skill/limit."""
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from app.database import SessionLocal
    from app.models.question import Question
    from app.models.question_explanation import QuestionExplanation
    from app.models.enums import SubjectArea
    from sqlalchemy.orm import joinedload

    db = SessionLocal()
    try:
        query = db.query(Question).options(
            joinedload(Question.domain),
            joinedload(Question.skill),
            joinedload(Question.explanation),
        ).filter(
            Question.is_active == True,  # noqa: E712
            Question.deleted_at == None,  # noqa: E711
        )

        if qtype == "math":
            query = query.filter(Question.subject_area == SubjectArea.MATH)
        elif qtype in ("reading", "grammar"):
            query = query.filter(Question.subject_area == SubjectArea.READING_WRITING)

        if skill_code:
            from app.models.taxonomy import Skill
            query = query.join(Skill, Question.skill_id == Skill.id).filter(
                Skill.code == skill_code
            )

        # Match Question Bank ordering: newest first, then by id for determinism
        query = query.order_by(Question.created_at.desc(), Question.id)

        if not force:
            # Skip questions that already have explanations
            query = query.filter(Question.explanation == None)  # noqa: E711

        if limit:
            query = query.limit(limit)

        questions = query.all()

        # For reading/grammar, further filter by domain code
        if qtype == "reading":
            questions = [q for q in questions if q.domain and q.domain.code != "SEC"]
        elif qtype == "grammar":
            questions = [q for q in questions if q.domain and q.domain.code == "SEC"]

        return questions
    finally:
        db.close()


def upsert_explanation(db, question_id, qtype: str, data: dict) -> None:
    """Upsert a QuestionExplanation record."""
    from app.models.question_explanation import QuestionExplanation

    existing = db.query(QuestionExplanation).filter(
        QuestionExplanation.question_id == question_id
    ).first()

    if existing:
        existing.explanation_type = qtype
        existing.steps_json = data
        existing.model_used = MODEL
    else:
        expl = QuestionExplanation(
            question_id=question_id,
            explanation_type=qtype,
            steps_json=data,
            model_used=MODEL,
        )
        db.add(expl)


# ─────────────────────────────────────────────────────────────────────────────
# Main run
# ─────────────────────────────────────────────────────────────────────────────

def run(qtype: Optional[str], skill_code: Optional[str], limit: Optional[int],
        apply: bool, force: bool) -> None:
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
        http_options=gtypes.HttpOptions(timeout=90_000),  # 90 seconds in ms
    )

    print(f"Loading questions (type={qtype or 'all'}, skill={skill_code}, limit={limit}, force={force})...")
    questions = load_db(qtype, skill_code, limit, force)

    if not questions:
        print("No questions to process.")
        return

    # For mixed type runs, filter by the specified type after loading
    if qtype in ("reading", "grammar"):
        # Already filtered above
        pass
    elif qtype is None:
        # Mixed: we'll detect type per question
        pass

    print(f"Processing {len(questions)} questions...")

    # Load progress checkpoint
    progress: dict[str, dict] = {}
    if PROGRESS_FILE.exists():
        try:
            progress = json.loads(PROGRESS_FILE.read_text())
        except Exception:
            pass

    results: dict[str, dict] = {}
    errors = 0

    def process_one(q):
        qid = str(q.id)
        if qid in progress and not force:
            return qid, progress[qid], False  # cached

        qt = qtype or get_question_type(q)
        # For mixed run without type filter, respect get_question_type
        if qtype is None:
            actual_qt = get_question_type(q)
        else:
            actual_qt = qt

        data = generate_explanation(client, q, actual_qt)
        if data:
            data["_question_id"] = qid
            data["_type"] = actual_qt
        return qid, data, True

    # Gemini 2.5 Flash paid tier: 15 RPM.
    # 5 workers with 4s gap = 15 RPM max, always a worker ready.
    import threading
    _submit_lock = threading.Lock()
    _last_submit = [0.0]
    _MIN_GAP = 4.0  # seconds between consecutive request starts

    def throttled_process(q):
        with _submit_lock:
            now = time.time()
            gap = _MIN_GAP - (now - _last_submit[0])
            if gap > 0:
                time.sleep(gap)
            _last_submit[0] = time.time()
        return process_one(q)

    # For incremental DB saves, set up DB session if apply mode
    db_session = None
    db_saved = 0
    if apply:
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from app.database import SessionLocal
        db_session = SessionLocal()

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(throttled_process, q): q for q in questions}
        done = 0
        for future in as_completed(futures):
            done += 1
            try:
                qid, data, is_new = future.result()
                if data:
                    results[qid] = data
                    if is_new:
                        progress[qid] = data
                        if done % 10 == 0:
                            PROGRESS_FILE.write_text(json.dumps(progress, indent=2, ensure_ascii=False))
                        # Incremental DB save every 50 questions
                        if apply and db_session and done % 50 == 0:
                            try:
                                import uuid as _uuid
                                for save_qid, save_data in list(results.items())[db_saved:]:
                                    actual_qt = save_data.get("_type") or qtype or "math"
                                    store_data = {k: v for k, v in save_data.items() if not k.startswith("_")}
                                    upsert_explanation(db_session, _uuid.UUID(save_qid), actual_qt, store_data)
                                db_session.commit()
                                db_saved = len(results)
                                print(f"  [DB] Incremental save: {db_saved} total saved")
                            except Exception as db_err:
                                db_session.rollback()
                                print(f"  [DB] Incremental save error: {db_err}")
                else:
                    errors += 1
                if done % 20 == 0 or done <= 5:
                    print(f"  {done}/{len(questions)} done, {errors} errors")
            except Exception as e:
                errors += 1
                print(f"  Worker error: {e}")

    # Save checkpoint
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2, ensure_ascii=False))

    print(f"\nGenerated {len(results)} explanations, {errors} errors")

    # Save preview
    PREVIEW_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"Preview saved to {PREVIEW_FILE}")

    if apply and db_session:
        try:
            import uuid as _uuid2
            saved = 0
            for qid, data in results.items():
                actual_qt = data.get("_type") or qtype or "math"
                store_data = {k: v for k, v in data.items() if not k.startswith("_")}
                upsert_explanation(db_session, _uuid2.UUID(qid), actual_qt, store_data)
                saved += 1
            db_session.commit()
            print(f"Saved {saved} explanations to DB (final)")
        except Exception as e:
            db_session.rollback()
            print(f"DB error: {e}")
            raise
        finally:
            db_session.close()
    else:
        print("\nDry run — use --apply to save to DB")
        print("Sample output:")
        for qid, data in list(results.items())[:1]:
            sample = {k: v for k, v in data.items() if not k.startswith("_")}
            print(json.dumps(sample, indent=2, ensure_ascii=False)[:2000])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate step-by-step SAT question explanations")
    parser.add_argument("--type", choices=["math", "reading", "grammar"],
                        help="Question type to generate (default: all)")
    parser.add_argument("--skill", help="Filter by skill code")
    parser.add_argument("--limit", type=int, help="Max questions to process")
    parser.add_argument("--apply", action="store_true", help="Save to DB (default: dry run)")
    parser.add_argument("--force", action="store_true", help="Regenerate even if explanation exists")
    args = parser.parse_args()

    run(
        qtype=args.type,
        skill_code=args.skill,
        limit=args.limit,
        apply=args.apply,
        force=args.force,
    )
