# Score-Raising Loop — Design Spec

**Date:** 2026-06-13
**Status:** Approved, building
**Goal:** Close the broken "between practice tests" loop so students measurably
improve test-to-test. Today the platform has the pieces (study plan, lessons,
adaptive practice, IRT mastery) but no connective tissue: the study plan is
frozen at import, practice never re-measures, and there's no guided progression.
This builds a **live, ordered worklist** driven by an honest **mastery-check**
gate, with tutor refine/override and visible before→after progress.

---

## 1. Core decisions (from brainstorming)

- **Primary driver:** a live, ordered **worklist** (the Study Plan tab becomes
  this). Auto-generates from a test's weak skills; tutor can refine.
- **"Done" mechanic:** explicit **mastery check** quiz + tutor judgment override.
- **Check questions:** fixed difficulty spread **1 easy / 2 medium / 2 hard**,
  tagged questions only (the 574 untagged questions are excluded), avoiding
  questions the student just practiced where possible.
- **Pass gate:** **≥4/5 overall AND ≥1 of 2 hard correct.** Can't pass on
  easy/medium alone. Fail shows which band was missed + routes to practice;
  **cap 2 retakes**, then item → `needs_tutor`. **Tutor override always wins.**
- **Tutor model:** worklist **auto-generates, tutor refines** (reorder, add,
  remove, mark done/reopen, lock). Student never waits on the tutor.
- **Progress shown:** inline on each worklist item, student dashboard summary,
  tutor per-student + cross-student views. (Predicted-score delta excluded.)
- **Honest baseline:** optional **baseline check** (same 1E/2M/2H instrument) so
  before→after is check-vs-check, not test-% vs check-%.
- **Architecture:** new `WorklistItem` + `MasteryCheck` tables; existing
  `StudyPlan` stays as the frozen per-test analysis + weak-skill generator.

### Verified data facts
- 3,862 questions; difficulty spread ~1,176 E / 1,094 M / 1,018 H; 574 untagged.
- 29 skills have questions (min 11, median 122) — fixed-spread check always
  satisfiable.
- **19 of 29 skills have a lesson; 10 do not** — known gap; no-lesson items hide
  the Learn button (fall to `needs_tutor` via the normal failed-check path).
- Staleness infra already exists (`STALE_SKILL_THRESHOLD_DAYS=21`,
  `get_stale_skills`, `_days_since_practice`) — used by the future forgetting loop.

---

## 2. Data model

`StudyPlan` is unchanged (frozen per-test analysis; still generates weak-skill
list via `_skill_rollup`).

### `worklist_items` — one row per skill a student is working
| Field | Type | Purpose |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | FK users, CASCADE | owner |
| `skill_id` | FK skills | the skill |
| `source_session_id` | FK test_sessions, nullable SET NULL | test that spawned it (null = tutor-added) |
| `status` | enum | `open` `in_progress` `passed` `needs_tutor` `done` `refresh` |
| `position` | int | order in list (tutor-reorderable) |
| `baseline_accuracy` | float, nullable | skill % on source test (rough "why flagged") |
| `baseline_check_id` | FK mastery_checks, nullable | authoritative "before" when taken |
| `current_accuracy` | float, nullable | latest measured % ("after") |
| `source` | enum `auto`/`tutor` | how it got here |
| `tutor_locked` | bool default false | tutor pinned; auto-gen won't remove |
| `lesson_id` | UUID nullable | cached lesson link if skill has one |
| `created_at`/`updated_at`/`completed_at` | timestamps | |

Unique `(student_id, skill_id)` — one active item per skill per student;
re-imports update, never duplicate.

### `mastery_checks` — one row per check attempt
| Field | Type | Purpose |
|---|---|---|
| `id` | UUID PK | |
| `worklist_item_id` | FK worklist_items, CASCADE | |
| `student_id` | FK users, CASCADE | |
| `kind` | enum `baseline`/`mastery`/`refresh` | which gate |
| `question_ids` | JSONB | the 5 served (ordered) |
| `responses` | JSONB | per-q: question_id, band, chosen, correct |
| `score` | int | # correct (0–5) |
| `hard_correct` | int | # hard correct (0–2) |
| `passed` | bool | score≥4 AND hard_correct≥1 (n/a for baseline) |
| `attempt_number` | int | retry tracking (mastery only; cap 2) |
| `created_at` | timestamp | |

**Deploy:** two new tables — Alembic migration required; **must be applied
manually on Railway** (start command does not auto-run `alembic upgrade head`).

---

## 3. Student worklist flow

Lives in the existing **Study Plan tab** (`/student/study-plan`).

### Item lifecycle
```
open ──start──> in_progress ──check passed──> passed ──tutor/auto──> done
                     │                                                  │
                     └──2 checks failed──> needs_tutor ──tutor──> in_progress/done
done ──stale 21d (FUTURE forgetting loop)──> refresh ──check──> done | reopen
```

### Item UI (per row)
- Skill name + before→after inline: `Systems of equations — 2/5 → 4/5 ✓`
  (check→check if baseline taken; else `test ~45% → 4/5`).
- Status chip: To do / In progress / Passed / Needs your tutor / Done.
- Actions by state: **Learn** (if `lesson_id`), **Practice** (adaptive,
  `?skill=&autostart=true`), **Baseline check** (open items, optional),
  **Take mastery check**.

### Closed loop
1. Open item → optional Baseline check → Learn → Practice → Take mastery check.
2. Check = 1E/2M/2H, tagged-only, avoid recently-practiced where possible.
3. **Pass** → `passed`, record after-score, **highlight next open item**
   ("Nice — next up: Polynomials").
4. **Fail** → show missed band, nudge to Practice/Lesson, retake w/ fresh Qs.
5. **2nd fail** → `needs_tutor`, surfaces to tutor. No infinite retries.
6. **Tutor override** → set `done`/reopen anytime.

### Empty/edge states
- No test imported → empty, "Import a practice test."
- No-lesson skill → Learn hidden; Practice + Check still available.
- All `done` → "Take your next practice test" (ties to ladder 6→7→11).

---

## 4. Tutor side

### A) Per-student worklist (tab on `/tutor/students/:id`)
Editable mirror: reorder (`position`), add skill (`source=tutor`,
`tutor_locked=true`), remove (soft), mark done/reopen (override), see
before→after + `needs_tutor` flags.

### B) Cross-student monitor (tutor dashboard/students)
Per student: skills cleared since last test, stuck (`needs_tutor`), not started.
One grouped query over `worklist_items` (the reason Approach A beat JSON).

### Auto-gen × tutor-refine rule
On import, generator adds items only for **newly weak skills not already on the
list**; **never touches `tutor_locked` or `done` items**. Manual edits survive
re-imports.

### Assignment tie-in (light)
"Add skill" may optionally drop a skill-scoped adaptive assignment via existing
`assignments.py`. No new assignment system.

---

## 5. Architecture & APIs

### Backend modules (small, single-purpose)
- `models/worklist.py` — `WorklistItem`, `MasteryCheck` + enums.
- `services/worklist_service.py` — generate-from-import (reuses `_skill_rollup`),
  reorder/add/remove, status transitions, stale-resurface query. Hooks into the
  import flow right after `generate_plan_for_session`.
- `services/mastery_check_service.py` — question selection (1E/2M/2H, tagged-only,
  exclude-recent), grading, pass rule, retry cap → `needs_tutor`, writes
  `current_accuracy`.
- `api/v1/worklist.py` — student + tutor endpoints.

### Endpoints
| Method · path | Who | Purpose |
|---|---|---|
| `GET /worklist` | student | live ordered list + per-item before→after/status |
| `POST /worklist/items/{id}/check` | student | start a check (kind=baseline/mastery); returns 5 Qs |
| `POST /worklist/checks/{id}/submit` | student | grade, transition, return result + next item |
| `GET /tutor/students/{id}/worklist` | tutor | editable view |
| `PATCH /tutor/worklist/items/{id}` | tutor | reorder / mark done / reopen / lock |
| `POST /tutor/students/{id}/worklist/items` | tutor | add skill (optional assignment) |
| `DELETE /tutor/worklist/items/{id}` | tutor | remove |
| `GET /tutor/worklist/overview` | tutor | cross-student monitor |

Auth via existing owner-or-tutor pattern.

### Frontend
- `StudyPlanPage.jsx` → live worklist (replaces static StudyPlan render).
- New `MasteryCheckPage` — reuses existing question-display/check components.
- Tutor: worklist tab on Student Detail + overview widget.
- Student dashboard: "This week: N skills improved" card (items with
  `completed_at` in last 7d).

### Progress signal (the 3 chosen places)
- Worklist item: inline baseline→current.
- Student dashboard: weekly improved-skills summary.
- Tutor: per-student (A) + cross-student (B).

---

## 6. Testing

Direct service+endpoint-function calls (the repo's HTTP TestClient is broken
under its Starlette/httpx pin — same approach used for join/delete/roster tests).

- **Generator:** import → correct items/order/baselines; re-import preserves
  `tutor_locked` and `done`.
- **Mastery check:** band composition (1E/2M/2H), tagged-only, exclude-recent;
  pass rule edge cases (4/5 with 0 hard = FAIL; 4/5 with 1 hard = PASS); retry
  cap → `needs_tutor`; `current_accuracy` write; baseline vs mastery `kind`.
- **Tutor edits:** reorder, add+lock, override done, remove.
- **Auth:** student can't access another's worklist; tutor only their students.

---

## 7. Out of scope (future, separate specs)

- **Forgetting loop (next up after this ships):** resurface `done` skills not
  practiced in 21d as a `refresh` item (one check; pass→done, fail→reopen).
  Minimal version reuses existing staleness infra; the `refresh` status and
  `mastery_checks.kind=refresh` are included now so it slots in cleanly. The full
  adaptive forgetting-curve algorithm is a larger, separate effort.
- **Question Bank redesign:** filters (difficulty/skill/wrong-answer), bookmarks,
  persistent progress. Lightly links to the worklist ("drill this skill") but is
  its own spec.
- **Predicted-score delta** from per-skill gains — deliberately excluded for now
  (rough/needs careful framing).
- **Tagging the 574 untagged questions** and **authoring lessons for the 10
  skills without one** — content gaps to fill later.
