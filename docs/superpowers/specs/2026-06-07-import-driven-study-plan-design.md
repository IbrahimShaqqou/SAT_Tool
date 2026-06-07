# Import-Driven Study Plan — Design

**Date:** 2026-06-07
**Status:** Approved, ready for implementation

## Goal

The official Bluebook practice test is the authoritative signal for each student.
Every import produces a **persisted, shared coaching plan**: real official score →
learn these skills → practice these skills → take this next test. Re-importing
refines the plan by showing per-skill movement since the last test. This replaces
the old mastery-derived study-plan engine, which wasn't useful.

Two audiences see the same plan: the **student** (their home base after a test)
and the **tutor** (one-click access from their students view).

## 1. Data model

New table **`study_plans`**, one row per imported attempt:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK users | indexed |
| `test_session_id` | UUID FK test_sessions, **unique** | the import this plan is built from |
| `test_number` | int | denormalized for convenience |
| `focus_skills` | JSONB | ordered ~6 weakest skills (see shape) |
| `also_review` | JSONB | remaining weak skills (<70%), same shape |
| `recommended_next_test` | int, nullable | next test number |
| `next_test_reason` | text | the difficulty/urgency note |
| `deltas` | JSONB, nullable | movement vs. previous import |
| `created_at` / `updated_at` | timestamptz | TimestampMixin |

Skill shape (`focus_skills` / `also_review` items):
```json
{"skill_id": 57, "name": "Boundaries", "domain": "Standard English Conventions",
 "subject_area": "reading_writing", "accuracy": 25.0, "correct": 2, "total": 8,
 "lesson_id": "uuid-or-null"}
```

`deltas` shape:
```json
{"score_change": 60, "prev_total": 990, "prev_test_number": 4,
 "section_changes": {"math": 20, "reading_writing": 40},
 "skills": [{"skill_id": 57, "name": "Boundaries",
             "prev_accuracy": 25.0, "accuracy": 63.0, "direction": "up"}]}
```

One row per `test_session_id`: regenerating (re-import of the same attempt) replaces it.

## 2. Plan generation (at import time)

Runs inside the existing import flow, after `mypractice_import` creates the
session + `StudentResponse` rows for an attempt:

1. Compute per-skill accuracy from this attempt's responses (reuse the rollup
   logic the review endpoint already uses).
2. Weak = accuracy < 70%, sorted weakest-first (tie-break: more attempted first).
3. `focus_skills` = top **6**; `also_review` = the rest.
4. Attach each skill's `lesson_id` (lookup in the lessons table by skill) so the
   "Learn" step links resolve; null if no lesson exists.
5. Compute `recommended_next_test` + `next_test_reason` (§3).
6. Compute `deltas` vs. the student's previous import (§4).
7. Upsert the `study_plans` row (unique on `test_session_id`).

Generation is best-effort and must never fail the import: wrap in try/except,
log on failure, leave the import successful.

## 3. Next-test recommendation

Inputs: which official tests the student has already imported (distinct
`test_number` of their completed OFFICIAL_PRACTICE sessions), and `user.test_date`.

- **Urgency path** — `test_date` is set and ≤ **21 days** away: recommend **PT6,
  then PT7** (hardest = most predictive), skipping the ladder. Reason:
  *"Your test is N days away, so we're going straight to the most predictive
  practice test."*
- **Ladder path** — otherwise: fixed order **[4, 6, 5, 7]**. Recommend the first
  not-yet-imported test in that order. Reason: *"A balanced next step. PT6 and
  PT7 run harder than average — don't sweat the score, we compare skill by skill."*
- All four taken (and not urgent) → `recommended_next_test = null`, reason:
  *"You've taken the core set. Retake your weakest test for a fresh read."*
- No `test_date` → ladder path.

The ladder and cutoff (21 days, `[4,6,5,7]`) are module-level constants for easy tuning.

## 4. Refinement (deltas)

On import, find the student's most recent **prior** completed OFFICIAL_PRACTICE
session (by `completed_at`, excluding the current one). If none, `deltas = null`.

- `score_change` = current total − prior total; same per section.
- For each skill present in **both** attempts' per-skill rollups: record
  `prev_accuracy`, `accuracy`, and `direction` (`up`/`down`/`flat`, flat within ±1pt).
- Whole-test, most-recent-two comparison (not cumulative).

## 5. API

- **Generation:** inside `POST /practice-tests/import` (no separate trigger). The
  import service gains plan generation per attempt.
- **Read:** `GET /practice-tests/sessions/{session_id}/plan` → plan payload
  (focus_skills, also_review, recommended_next_test, next_test_reason, deltas,
  plus test_name/number for display). Authorized **owner-or-tutor** via the
  existing `_get_session_for_viewer` helper. 404 if no plan row (e.g. an old
  import predating this feature).

## 6. Frontend — student

- **Results page (existing):** Overview already leads with official score + skill
  map. Additions:
  - A prominent **"What to do next →"** button linking to the plan.
  - When deltas exist, a compact **"Since your last test"** strip: score change
    (↑/↓ N) and 2–3 notable skill movements.
- **New Plan view** — a third tab on the results page (`tab=plan`), so the URL
  stays `/student/practice-tests/results/:sessionId`:
  - Ordered **focus skill** cards, each with **Learn → Practice** sub-steps that
    deep-link to the existing lesson viewer and adaptive practice
    (`/student/lessons/:lessonId`, `/student/adaptive?skill=:id&autostart=true`).
    Lesson step hidden/disabled if no lesson exists for the skill.
  - **"Also worth reviewing"** collapsed list.
  - **"Take PT_ on Bluebook next"** card with the reason note; links to the
    import page for when they return. Null-next-test → retake-weakest message.
  - "Done" reflects real lesson/practice state where available; no separate toggle.

## 7. Frontend — tutor

- The tutor's student-result view (`/tutor/students/:id/practice-tests/:sessionId`,
  already reusing the results page in tutor mode) gets the same **Plan** tab,
  read-only (no Learn/Practice deep-links that only make sense for the student;
  show them as labels, not actions).
- **Easy access:** on the tutor's student detail "Practice tests" tab, each test
  row already links to the result; add a direct **"View plan"** affordance so a
  tutor reaches the plan in one click.

## 8. Phasing out the old engine

- Deprecate `recommendations.py::_build_study_plan_tasks` and
  `GET /recommendations/study-plan`, and the mastery-derived `StudyPlanPage`.
- Repoint the sidebar **"Study Plan"** link to the student's **latest import's
  plan** (`/student/practice-tests` if none yet, with an empty state prompting an
  import).
- Keep the lessons and adaptive-practice engines — the plan links into them.
- Remove the old recommendation wiring once the new plan view is live and verified.

## 9. Testing

- **Unit (plan generation):** weak-skill selection + 6 cap + also_review split;
  lesson_id attachment; next-test logic (ladder progression, urgency cutoff at 21
  days, no-date fallback, all-taken); delta computation (skills in both, score +
  section change, missing-prior → null).
- **Integration:** import → `study_plans` row with correct focus + next test;
  re-import of a second test → deltas populated; plan endpoint owner-or-tutor auth
  (student ok, their tutor ok, unrelated tutor 403, missing plan 404).

## Out of scope (YAGNI)

Per-domain theta weighting, adaptive question targeting, plan-level done toggles,
difficulty-normalized score comparison, recommending non-official tests.
