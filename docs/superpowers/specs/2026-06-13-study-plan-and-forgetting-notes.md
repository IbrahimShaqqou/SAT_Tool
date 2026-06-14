# Study-Plan Prioritization & Forgetting Loop — Research + Design Notes

**Date:** 2026-06-13
**Status:** Design notes (approved direction; not yet built). Build order:
**(1) prioritization + gentle time-aware sizing, then (2) forgetting loop.**

These are decisions + research to turn into specs when we build. Sources cited
inline; "official" = College Board, "prep" = prep-company opinion/inference.

---

## A. Study-plan prioritization (build FIRST)

### Model (approved)
Order the worklist by:
```
priority = weakness × domain_frequency × learnability × test_proximity
```
No fabricated per-question "point values" — College Board does not publish the
IRT equating, so point-value estimates are unreliable. Frequency is the trusted
impact proxy.

### Inputs
- **weakness** — from the student's per-skill mastery / accuracy (StudentSkill,
  or the test's `_skill_rollup`). Lower = higher priority.
- **domain_frequency** — official CB domain weights (below). A static per-skill
  or per-domain constant.
- **learnability** — per-domain coefficient (prep consensus, flag as heuristic):
  rule-based skills improve fastest per hour. High: Standard English Conventions
  (grammar), Expression of Ideas (transitions), Algebra (procedural). Low:
  Information & Ideas, Craft & Structure (reading comprehension, slow to move).
- **test_proximity** — from `user.test_date`; closer = sharper weighting toward
  the few highest-impact skills.

### Official CB domain weighting (primary source: spec PDF)
satsuite.collegeboard.org/media/pdf/digital-sat-test-spec-overview.pdf

Math (~44 Q): Algebra 35% (~14) · Advanced Math 35% (~14) · Problem-Solving &
Data Analysis 15% (~6) · Geometry & Trig 15% (~6). → Algebra + Advanced Math ≈
70% of Math (dominant lever).

Reading & Writing (~54 Q): Craft & Structure 28% (~14) · Information & Ideas 26%
(~13) · Standard English Conventions 26% (~13) · Expression of Ideas 20% (~10).
→ Much flatter; no single domain dominates.

Note: R&W and Math are separate 200–800 scales. Within-section share differs
from whole-test share.

### Gentle time-aware sizing (UX, approved)
- NEVER tell a student "you don't have time for everything."
- Always show ALL weak skills — nothing hidden.
- Visually **elevate the top few** ("Start here" hero treatment) and render the
  rest as a quieter, smaller "also work on these" list.
- The COUNT given hero prominence scales with days-left (e.g. 1–2 heroes at ~8
  days, more at ~60). The long tail stays visible, just de-emphasized.
- Maps naturally onto the existing StudyPlan `focus_skills` (prominent) vs
  `also_review` (quiet) split.

### Scoring-myth correction (important for any future "points" feature)
"Harder questions are worth more" is wrong at the question level. Per Applerouth's
analysis of official practice scoring, IRT rewards **discrimination**: missing an
EASY question costs more than missing a hard one. What drives score: (1) Module 1
accuracy routes you to the higher-ceiling Module 2; (2) avoiding careless errors
on easy/medium items. → A worthwhile FUTURE feature: flag careless easy-question
misses as high-value to fix. Not in initial scope.

---

## B. Forgetting loop / spaced repetition (build SECOND)

### Approved approach: Leitner, skill-level, test-date-clamped
- Reuses infra already present: worklist `refresh` status, `mastery_checks.kind
  = 'refresh'`, `StudentSkill.last_practiced_at`, `STALE_SKILL_THRESHOLD_DAYS`,
  `get_stale_skills`, `_days_since_practice` (irt_service.py).
- Schedule at the **skill** level; never re-show the same question — draw a fresh
  question of matching difficulty (the Duolingo model). A "review" = a refresh
  mastery check (same 1E/2M/2H instrument).
- **Boxes / intervals** ~ `2 / 4 / 7 / 14` days (doubling-ish), tunable.
- A `done` skill past its due date resurfaces as a `refresh` worklist item at the
  top. Pass → promote box (longer interval). Fail → back to box 1 + reopen.
- **Test-date clamp (the SAT-specific part):** never schedule a review after the
  test date — pull it earlier. Compress intervals as the test nears so every
  high-priority skill gets a final refresh 1–3 days before test day.
- Daily review cap to avoid pile-up; if overloaded, prioritize by the same
  impact model (frequency × weakness).

### Why NOT FSRS (for now)
FSRS (Difficulty/Stability/Retrievability, per-user parameter fitting) is more
accurate but needs much more data + complexity to pay off, and the finite test
horizon undercuts its lifelong-retention optimization. Leitner gets ~80% of the
benefit for ~10% of the work. FSRS is a possible future upgrade.

### SR pitfalls to avoid
- Don't copy Anki's lapse-ease penalty → "ease hell" (items recur forever).
- Cap daily reviews; pause new items when a backlog builds.
- Don't re-show identical questions for skills (memorizing answers ≠ mastery).

---

## Key sources
- CB spec (domains, adaptivity, IRT scoring): satsuite.collegeboard.org/media/pdf/digital-sat-test-spec-overview.pdf
- CB how-scores-calculated (IRT, difficulty affects score): satsuite.collegeboard.org/scores/what-scores-mean/how-scores-calculated
- Applerouth (easy-miss weighting / discrimination): applerouth.com/blog/sat-question-weighting-what-matters-most-on-the-test
- Forgetting curve / SR / Leitner / SM-2 / FSRS / Duolingo HLR: see 2026-06-13 research (Wikipedia, super-memory.com SM-2, awesome-fsrs wiki, Duolingo HLR blog).
