# Question Bank Redesign — Design Spec

**Date:** 2026-06-13
**Status:** Approved, building (all in one pass)
**Goal:** Turn the passive domain→skill→load-all browser into a real study tool:
filterable/searchable browse, persistent progress, wrong-answer review,
bookmarks, a clean practice view (shared test layout), tutor browse/assign, a
screen-share "Focus mode," and a light link from the worklist.

---

## 1. Decisions (from brainstorming)

- **Student features:** filters + search, persistent progress, bookmarks,
  wrong-answer review — all four.
- **Tutor use:** browse + multi-select assign (reuse existing assignment flow);
  also live-session practice via screen-share Focus mode.
- **Relationship to worklist:** "mostly standalone, lightly linked" — bank is its
  own tool; worklist's Practice can open the bank pre-filtered to a skill.
- **Build:** all in one pass.

### Verified facts
- Bank "Check Answer" (`POST /questions/{id}/check`) is **stateless** — records
  nothing (that's why progress resets).
- `StudentResponse.test_session_id` is **nullable** → a bank attempt can be a
  `StudentResponse` with `test_session_id = NULL`. Reuse it; no new attempt model.
  Bonus: bank practice then also feeds IRT skill mastery + existing tutor views.
- **No bookmark concept exists** — needs one small table.
- 3,862 questions; difficulty tagged E/M/H (574 untagged); 29 skills with Qs.

---

## 2. Data & backend

### Reuse
- **Attempts → `StudentResponse`, `test_session_id = NULL`**, tagged with
  `source = "question_bank"` (store in `response_json`, e.g. `{"index": 2,
  "_source": "question_bank"}`, or add a nullable `source` column — prefer the
  response_json marker to avoid a column migration on the hot table).
- **`check_answer`** service reused for grading.

### New table: `question_bookmarks`
| Field | Type |
|---|---|
| `id` | UUID PK |
| `student_id` | FK users CASCADE |
| `question_id` | FK questions CASCADE |
| `created_at` | timestamp |

Unique `(student_id, question_id)`.

### Endpoints
| Method · path | Purpose |
|---|---|
| `GET /questions` (extend) | filters: `difficulty`, `skill_id`, `domain_id`, `status` (unattempted/correct/incorrect), `bookmarked`, `q` (search), pagination |
| `POST /questions/{id}/attempt` | record a logged-in student's attempt (reuses `check_answer`); returns is_correct + correct_answer + explanation. Stateless/no-record for logged-out (public bank). |
| `GET /questions/bookmarks` | list the student's bookmarked question ids |
| `POST /questions/{id}/bookmark` | add bookmark |
| `DELETE /questions/{id}/bookmark` | remove bookmark |
| `GET /questions/my-stats` | per-skill attempted/correct for the progress strip (or fold into existing progress endpoint) |

The existing stateless `/check` stays for the public (logged-out) bank.

**Deploy:** new `question_bookmarks` table — Alembic migration, **manual-apply on
Railway** (start command doesn't auto-run migrations). Use `create_type`-safe
patterns; no enums here so low risk.

---

## 3. Student UI

### A) Browse view (new home)
- **Left rail filters** (collapsible on mobile): Difficulty (E/M/H chips),
  Domain → Skill, status toggles (Unattempted / Got wrong / Got right /
  Bookmarked), and a **search box**.
- **Paginated card list** (not all-at-once): prompt snippet, skill tag,
  difficulty pill, status marker (○ untried / ✓ correct / ✗ missed / ★ saved).
  Click → practice view with the filtered set as the deck.
- **Progress strip** on top: attempted / accuracy + quick chips ("Review what I
  got wrong", "Saved questions").

### B) Practice view
Canonical shared test layout (SplitPane for reading, Draw/Reference/Calculator
toolbar, QuestionDisplay + AnswerChoices). Study additions:
- **Check Answer** → records the attempt (persistent) + correct/incorrect +
  step-by-step explanation.
- **★ Bookmark** toggle per question.
- Prev/Next through the filtered deck.

### C) Focus / screen-share mode
A toggle in the practice view that: hides sidebar/nav chrome and personal status
markers (so a watching student doesn't see "you got this wrong"), bumps
font/spacing for shared-screen readability, keeps Check Answer + explanation +
calculator. Same view, presentation-cleaned. Available to students and tutors.

### Empty/edge states
No filter matches → "nothing matches, clear filters"; "Got wrong" empty → "you
haven't missed any yet."

---

## 4. Tutor + linking

- **Browse/assign:** same browser; status filters hide for tutors. Multi-select
  → selection bar → hands question_ids to the **existing** assignment flow
  (`/tutor/assignments/new` pre-filled). No parallel assignment system.
- **Focus mode** available to tutors for live screen-share sessions.
- **Worklist link:** worklist item's Practice gains a "drill in question bank"
  option (bank pre-filtered to that skill), alongside adaptive. One-way; bank
  stays standalone.
- **"What they practiced":** bank attempts persist as `StudentResponse`, so the
  tutor's existing student views automatically include bank practice. No separate
  bank-activity screen.

---

## 5. Architecture

### Backend
- `models/question_bookmark.py` — `QuestionBookmark`.
- `services/question_bank_service.py` — filtered query (status/bookmark joins),
  record-attempt, bookmark CRUD, my-stats.
- `api/v1/questions.py` — extend list + add attempt/bookmark/stats routes.

### Frontend
- Rework `pages/shared/QuestionBankPage.jsx` — browse view (filters + cards +
  pagination + progress strip) and practice view (reuse the now-standard test
  layout + Check/Bookmark/Focus).
- `services/questionService.js` — new filter params + attempt/bookmark/stats.
- Worklist item: add "drill in question bank" link.

---

## 6. Testing
Direct service/endpoint calls (HTTP TestClient broken under repo's pin):
- Filter query: difficulty/skill/status/bookmarked/search each narrow correctly;
  pagination.
- Attempt recording: creates a `StudentResponse` with null session + source
  marker; grading correct; logged-out path records nothing.
- Bookmarks: add/remove/list, unique constraint, "bookmarked" filter.
- Wrong-answer filter returns only missed questions.
- Auth: a student only sees/affects their own attempts/bookmarks.

---

## 7. Out of scope (future)
- Bank-attempt analytics dashboard, per-question tutor notes, shared decks /
  playlists. Tagging the 574 untagged questions.
