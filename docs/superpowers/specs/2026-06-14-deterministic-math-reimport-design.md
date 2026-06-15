# Deterministic Math Re-Import — Design Spec

**Date:** 2026-06-14
**Status:** Approved, building.
**Problem:** Imported math questions render incorrectly. The current pipeline
feeds the human-readable `alttext` ("StartFraction 12 x plus 28 Over 4
EndFraction") through a ~976-line regex/AI converter (`alt_text_to_latex` +
`ai_*` correction files) to *reconstruct* LaTeX. That prose-parsing introduces
errors (spurious ×, bad fractions). **But the source data already contains exact,
structured MathML for ~73% of math questions** — the converter is solving a
problem the data doesn't have.

## Root cause (verified)
- `math_core.json` / `math_norm.json` hold 1756 math questions.
- ~73% (1296): `content` is a dict with native **MathML** `stem` + `alttext` +
  `answerOptions` (MCQ) + `rationale`. Structured, unambiguous.
- ~27% (459): `content` is a list whose entry has a clean HTML `prompt` +
  `answer.choices` — already-rendered, no math markup.
- Reading questions contain no math.
- The pipeline discards the MathML and reconstructs from `alttext` → corruption.

## Decisions
1. **Render source MathML directly** (Approach A). MathJax already loads
   `tex-mml-chtml` (MathML-capable). No conversion layer, no AI.
2. **Re-import ALL math questions** from source, replacing the mangled DB values.
3. **Retire** the AI/regex converter (`alt_text_to_latex`) and `ai_*` correction
   files from the pipeline (kept in git history; removed from use).
4. Reading is out of scope (no math).

## The join (verified)
Match the source file's **top-level dict UUID key** → `Question.external_id`
(1681/1756 = 96% match). NOT `content.externalid` (only 256 match — different ID).
Unmatched source entries are logged + skipped; no new rows created (re-render only).

## What gets rebuilt per question
- dict-content: `content.stem`→prompt_html, `content.answerOptions`→choices_json,
  `content.rationale`→explanation_html, `content.correct_answer`/`keys`→correct_answer_json.
- list-content: the entry's `prompt`→prompt_html, `answer.choices`→choices_json, etc.
- Untouched: skill, difficulty, taxonomy, IDs.

## Deterministic cleanup (the ONLY processing; no AI)
1. Decode stray HTML entities that break rendering (`&gt;`, `&#62;`, etc.).
2. Ensure `xmlns="http://www.w3.org/1998/Math/MathML"` on `<math>` lacking it.
3. Trim empty wrappers / normalize whitespace.
4. MathML structure (`<mfrac>`, `<mfenced>`, `<mi>`, `<mo>`) passes through verbatim.

## Components
- `app/services/question_content.py` — pure functions: `clean_html(s)`,
  `extract_from_source(entry) -> {prompt_html, choices_json, correct_answer_json,
  explanation_html, answer_type}`. Handles both content shapes. No I/O.
- `scripts/reimport_math_from_source.py` — loads source files, joins by external_id,
  applies extract+clean, updates DB. Dry-run mode (report + sample diffs, no write)
  and real run. Idempotent.

## Frontend
No change required — prompts render via `MathHtml.jsx` (runs MathJax). Verify all
prompt-display surfaces (QuestionBank practice, MasteryCheck, results review) use
`MathHtml`, not raw innerHTML.

## Testing (with real questions)
- Unit: feed real `math_core.json` entries through `extract_from_source`+`clean_html`;
  assert MathML preserved, entities decoded, no operators added, `<math>` balanced,
  prompt is valid HTML.
- Dry-run on the real DB: before/after diff for known-broken (× ) questions.
- Coverage: count matched/unmatched, dict vs list shapes, % with MathML.

## Build outcome (2026-06-14)
Applied. Source coverage of the 1756 math questions:
- **1288 (74%) native MathML** → rendered directly, deterministic, lossless.
- **168 (10%) plain word problems** → clean HTML, no math markup.
- **299 (17%) base64 PNG images** → the source stores the math as a pre-rendered
  `<img src="data:image/png...">`. Decision: **use the source image** — exact and
  error-free (it's a picture), a net win over the AI-converted LaTeX that lived
  there. (Future: math-OCR these to MathML; not now.)

Re-import results: 1681/1756 matched DB rows (75 unmatched, logged/skipped; 1
extract-fail), 1678 updated, idempotent on re-run (0 further changes). Tests: 9
content tests against real source (MathML preserved, entities decoded, indices
correct, math balanced, no spurious ×). Frontend unchanged — QuestionDisplay /
AnswerChoice / HighlightableText already run MathJax (tex-mml-chtml) over prompts.

## Out of scope / future
- Reading re-import. The 75 unmatched questions (~4%) and the 299 image-math
  questions (later OCR→MathML). Removing the dead converter files
  (`alt_text_to_latex`, `ai_*`) from the repo entirely (left in history for now;
  no longer in the pipeline).
