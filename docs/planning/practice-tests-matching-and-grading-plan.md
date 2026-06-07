# Practice Tests: Matching & Official-Fidelity Grading — Plan

**Date:** 2026-06-01 (updated 2026-06-05)
**Status:** MATCHING SOLVED via MyPractice API — PT4–7 re-imported clean. Grading still TODO.

## UPDATE 2026-06-05 — MyPractice API discovery supersedes the matching plan

The fuzzy-match pipeline is obsolete. The MyPractice results page calls a clean JSON API:
`POST digitalpractice-api.collegeboard.org/mspractice-testresults-prod/{scores,questions}`.
- `/questions` returns the 98 questions an attempt administered (Module 1 + one Module 2 path)
  with full content, choices, `correctChoice`, official `rationale`, domain/skill `metadata`, and
  the stable `externalId` (== `questions.external_id`). No matching needed.
- `/scores` returns the official IRT score + per-domain theta + the full 145-id form list.
- Two attempts per test (one easier-path, one harder-path) = the complete adaptive form.

**Captured** all of PT4/5/6/7 (both paths each) + PT10 (one mixed take, old format) to
`data/bluebook_captures/` (see CAPTURE_MANIFEST.md). **Imported** PT4–7 via
`backend/scripts/import_from_mypractice_api.py`:
- 143–145 questions per test inserted into the bank (is_verified=True; difficulty/IRT null —
  not in payload), 0 unmapped (all domains + skills resolved).
- Each PracticeTest re-seeded with 6 modules at exact 27/27/27/22/22/22 counts.
- Verified: all 24 modules 100% resolve, 0 missing answers, 0 missing explanations.
- PT6's old short-module bug is fixed. Deleting/recreating PracticeTest rows is safe — only
  `practice_test_modules` cascade; `student_responses` reference questions/sessions, untouched.

Remaining: PT10 needs a fresh re-take (old capture format, no externalId). PT1–PT3 do not exist
(SAT only publishes 4–10). Grading engine (Track B below) is unchanged and still pending — though
the official `/scores` value is now stored as anchors to validate against.

## UPDATE 2026-06-05 (later) — self-serve import pipeline built

Built a full student-facing import pipeline so anyone can bring their Bluebook results in:

1. **Browser extension** (`tools/zooprep-importer-extension/`, Chrome MV3). A MAIN-world hook wraps
   `fetch`/`XHR` on mypractice.collegeboard.org to capture the catapult auth token the app already
   uses, then replays `/scores` (all attempts) + `/questions` (per attempt) — collecting every test
   and both adaptive paths in one click. Token never leaves the page. Delivery is configurable:
   auto-upload to ZooPrep or download `zooprep-bluebook.json`. Options page stores ZooPrep URL/token.
2. **Backend** (`app/services/mypractice_import.py` + `POST /api/v1/practice-tests/import`). Shared
   service: upserts questions by external_id, classifies each attempt's Module-2 path per-section
   from real Module-1 correctness, seeds the 3 module variants, and records official scaled scores +
   per-domain theta as scoring anchors on `test_metadata`. `?dry_run=true` validates without writing.
   Verified against the existing captures: 784 questions matched, all 4 tests usable, 0 unmapped.
3. **Frontend** (`pages/student/ImportBluebookPage.jsx`, route `/student/practice-tests/import`,
   linked from the Practice Tests header). Drag-and-drop the JSON bundle → calls the import endpoint
   → shows per-test summary (attempts, anchors, modules seeded).

Pipeline is live and end-to-end verified (route present in the running API). Distribution: extension
is load-unpacked ready; needs icons + Web Store packaging + privacy disclosure for student self-serve.

## UPDATE 2026-06-05 (later still) — anchor-curve scoring engine (Track B) DONE

Replaced the single-point linear heuristic with real captured CB score data.
- `backend/data/sat_score_anchors.json` — real (raw_section_correct → scaled) anchors per
  test/section/path, ground-truth path from the 8 captured attempts + path-blind /scores points
  assigned via upper-envelope. Sparse but real (PT4 Math harder has 6 points incl. easier-path pair).
- `app/services/anchor_scoring.py` — exact match → "official" (literally CB's number); between
  anchors → "estimate" with ±30 range, monotonic-by-construction; out-of-range / <2 anchors → None.
- `app/services/sat_scoring.py::score_full_length_test(..., test_number=...)` — anchors-first per
  section, calibrated linear model as fallback. Returns score_method ("official"|"estimate"|"model")
  + low/high range per section and total. Backward compatible (test_number optional).
- Results API (`TestResults`/`SectionScore`) and the results page now surface method + range
  honestly ("Official College Board score" vs "Estimated … · likely 580–620").
- Tests: `tests/test_anchor_scoring.py` (11 passing); `tests/test_practice.py` still green (25).
  Verified PT4 perfect-M1/0-M2 → exact official 1080 (Math 550 + RW 530).

Net: where a student's section raw matches a captured anchor we show CB's real score; between
anchors a calibrated estimate+range; elsewhere the model. Coverage tightens with each new attempt.
ALL planned tracks (matching + import pipeline + grading) are now complete for PT4–7.

## UPDATE 2026-06-05 (final) — import is now the main path; results hit student + tutor

Made Bluebook import the primary way to "take" practice tests and wired the data into both audiences.

- **Import → real results.** `mypractice_import._create_result_session` turns each attempt into a
  completed OFFICIAL_PRACTICE `TestSession` + a `StudentResponse` per question, owned by the
  importing student. Stores official scaled score + per-domain theta in `session_state`. Idempotent
  by `rosterEntryId`. Endpoint passes `current_user.id`. Verified live: import → existing `/results`
  returns total 1080 / Math 550 / RW 530, all flagged "official".
- **Student surfacing.** New `GET /practice-tests/my-results`; Practice Tests page shows a "Your
  results" list (official badge + scaled score, links to the results page); import page deep-links
  to results after upload; results page shows official/estimate method + range.
- **Tutor surfacing.** `SessionBrief` gained `title`/`scaled_score`/`is_official`; new "Practice
  tests" tab on the tutor StudentDetail page lists the student's official imports with scaled scores.
- **Extension finished for self-serve.** Icons (16/48/128), `PRIVACY.md`, `build.sh` packaging →
  `zooprep-importer.zip` (published to `frontend/public/extension/` so the in-app "Get the
  extension" button works). In-app "Connect for auto-upload" panel on the import page surfaces the
  ZooPrep URL + access token to paste into the extension's Settings.
- **Tests.** `test_mypractice_import.py` (4) green; full relevant suite 58 passing; all touched
  frontend files lint-clean.

Remaining polish (non-blocking): real branded icons; token auto-refresh in the extension (currently
re-copy when it expires); PT10 re-take; optional tutor view of per-domain theta detail.

---
## (Original plan below — matching sections now superseded)

**Date:** 2026-06-01
**Status:** Planning complete, ready to execute
**Scope:** Audit Bluebook-imported practice tests, complete question matching, replace the grading engine with the best-achievable official-fidelity model.

---

## 1. Current state (verified against live Postgres `sat_tutor`, port 5433)

Practice tests are imported from `mypractice.collegeboard.org`: take test → JS console scrape →
fuzzy text match to the 3,288-question bank → seed as `practice_test_modules` (ordered
`external_id` arrays). uIds key off `questions.external_id`.

| Test | In DB | Matching | Notes |
|------|-------|----------|-------|
| **PT4** | ✅ | ✅ 98/98 both variants | All answers present, fully gradable |
| **PT5** | ✅ | ✅ 98/98 both variants | All answers present, fully gradable |
| **PT6** | ✅ | ⚠️ short modules | 10 questions failed matching (see §2) |
| **PT1–PT3** | ❌ | ❌ | **No source capture exists on disk** — needs fresh scrape |

Every `external_id` mapped in the DB resolves to a real question **with a non-null
`correct_answer_json`** (verified: 0 missing across all 18 seeded modules). Everything that *is*
mapped is gradable.

## 2. PT6 root cause (fully diagnosed)

- PT6 **capture is complete** (98 questions, correct RW/Math split) at
  `backend/data/practice_test_6_questions_{easy,hard}.json`.
- **10 questions failed auto-matching** and were written as placeholder uIds
  (`pt6-unmatched-q{7,21,28,30,41,42,51,53,57,63}`) in the mapping JSONs.
- `seed_practice_test_6.py` **silently dropped** these placeholders → short DB modules:
  RW M1=24 (want 27), RW M2_easier=19 (want 27), RW M2_harder=25, Math M1=20 (want 22).
- **8 of 10 are genuinely absent from the bank** (best fuzzy match <42%) — not a threshold
  problem. They must be **imported as new questions** from the capture. Q57/Q63 (math) are
  borderline (~56–60%) and may be re-matchable to existing bank items.
- All 10 are MCQ with the correct answer explicitly marked `class="correct"` in capture HTML,
  format `{"index": N}` matching existing questions → recoverable and gradable.
- **Bug in `import_pt6_unmatched.py`:** for Q53 (rhetorical-synthesis "student notes", 9 `<li>` =
  5 note bullets + 4 choices), `extract_correct_answer` returns index 8 over all `<li>` while
  `choices_json` holds only 4 → out-of-range / broken grading. Index must be relative to answer
  choices only.

## 3. Grading: current state and the hard truth

`backend/app/services/sat_scoring.py` is a **linear formula calibrated to ONE real data point**
(PT5, 2026-05-23):
- Harder path: `200 + 280·(M1%) + 40 + 320·(M2%)` → floor ~520, ceiling 800
- Easier path: `200 + 380·(M1%) + 80·(M2%)` → ceiling ~660
- Adaptive routing hardcoded at 55% on Module 1.

**Research finding (2026-06-01):** Official per-test raw→scaled conversion tables are **not
publicly knowable**. College Board uses IRT-based equating and never releases item parameters or
per-form tables. The only way to get the true official score is to enter answers in Bluebook
itself. Public approximations land within ~±20–40 points.

What's actionable from research:
- **Best public calibration data:** PrepMaven ran Bluebook **Practice Test #1 31 times**, recording
  section score as a 2D grid of `(Module 1 misses × Module 2 misses)`, separately for Math and R/W.
  Source: prepmaven.com/blog/test-prep/sat-score-calculator/
- Scoring is **non-linear and non-uniform**: same number-correct → up to 150-pt spread depending
  on path and which items missed. A flat raw-count line cannot model this.
- **Routing threshold** ~14/22 Math, ~18/27 R/W (uncertain; make it config, not hardcoded 55%).
- **Easy-path ceiling** ~600–670 per section (never approaches 700).

## 4. Decisions (locked)

- **Grading model:** 2D lookup table `(M1 misses × M2 misses) → scaled score`, per section, per
  path, seeded from PrepMaven PT#1 grid, smoothed monotonic. One shared approximation per path is
  "close enough" given public-data limits.
- **Score display:** estimated **range + "unofficial estimate"** label (e.g. "≈680–720").
- **Track ordering:** A (matching) and B (grading) in parallel.
- **Extraction source:** existing local captures (covers PT6; PT1–PT3 require a new scrape).

## 5. Work plan

### Track A — Complete matching
1. **Fix `import_pt6_unmatched.py`** (Q53 index bug: index relative to answer choices, not all
   `<li>`; handle SPR vs MCQ correctly). Import the 8 absent questions as new bank entries.
2. **Re-match Q57/Q63** against the bank at a lower threshold; import as new only if still absent.
3. **Replace placeholders** in PT6 mapping JSONs with the imported `external_id`s.
4. **Harden `seed_practice_test_*.py`:** fail loudly (not silently drop) on any uId that doesn't
   resolve to a question; assert module counts == official 27/27/22/22.
5. **Re-seed PT6**; verify full 27/27/22/22.
6. **Add a DB audit script** that checks every practice-test module: count vs official, all uIds
   resolve, all have `correct_answer_json`. Run across PT4/5/6.
7. **PT1–PT3 (blocked):** stage the ingestion pipeline so it's one command once captures exist;
   document the scrape procedure. Requires user to take tests on mypractice + run JS extractor.

### Track B — Official-fidelity grading
1. **Encode the PrepMaven 2D grids** (Math + R/W) as data: `backend/data/sat_score_tables.json`
   (or per-test if we later get more). Smooth/interpolate to a monotonic surface; extrapolate the
   sparse cells.
2. **Rewrite `sat_scoring.py`:** look up `(m1_misses, m2_misses, section, path)` → point estimate +
   confidence band; routing threshold becomes a config constant; easy-path hard-capped ~670.
3. **Validate** against the known real PT5 data point and the PrepMaven grid cells.
4. **Update API/response models** (`practice_tests.py`, `TestResults`/`SectionScore`) to carry a
   range (low/high) + estimate flag; keep a point value for storage.
5. **Frontend:** display range + "unofficial estimate" label (separate task when touching UI).

### Verification
- DB audit script passes for PT4/5/6 (counts, resolution, answers).
- Grading unit tests: PT5 real data point within tolerance; monotonicity; easy-path ceiling;
  routing threshold.
- End-to-end: start → submit modules → results returns sensible range for a known response set.

## 6. Known blockers / risks
- **PT1–PT3:** no local data; requires user scrape. Hard blocker for "all 6 tests."
- **Grading fidelity ceiling:** ±20–40 pts is the floor of error from public data; cannot be
  eliminated without Bluebook itself or real item parameters. UI must communicate this.
- Newly imported PT6 questions have null difficulty/skill/IRT params (calibrate later from student
  data); fine for grading (only correct/incorrect matters) but flagged `is_verified=False`.
