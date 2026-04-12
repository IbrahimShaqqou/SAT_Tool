# ZooPrep - Remaining Work

This document outlines all remaining work needed before the platform is production-ready.

**Domain:** https://zooprep.com

---

## Roadmap (Ordered)

### Phase 1 — Question Normalization ← NEXT
Convert all question HTML to a single clean format: math-as-LaTeX, properly sized real images.
See detailed plan below under **"Phase 1: Question Normalization Plan"**.

### Phase 1b — Raster Graph → SVG Conversion (81 questions)
81 questions have raster `<img>` graph images that need to be replaced with clean SVGs matching the existing style.

**Breakdown:** 55 coordinate graphs, 11 geometry, 8 tables, 4 charts, 3 3D shapes.

**Plan:**
1. For each image question, send image + CB alt text to Claude Vision → structured JSON (axis ranges, lines/curves, labels, intercepts)
2. Python SVG renderer per graph type (coordinate plane, table→HTML, geometry, chart)
3. Replace `<img>` in `prompt_html`/`choices_json` with generated SVG
4. Flag any Claude can't parse for manual review

**Key insight:** CB alt texts are detailed enough that coordinate graphs (55) may need no Vision at all — alt text already describes slopes, intercepts, ranges.

**Script:** `backend/scripts/convert_graph_images.py`

### Phase 2 — Step-by-Step Explanations
LLM-generated per-question walkthroughs (oneprep.xyz style).
- JSON schema: `steps[]` with `title`, `stepText` (markdown), `textHighlights` (exact substrings, color, `highlightedIn: stimulus|prompt|answer_choice`)
- Generate via Claude API, validate substring accuracy, store in separate `QuestionExplanation` table
- Frontend: accordion/stepper UI with colored highlight spans

### Phase 3 — Semantic Analysis
- Add pgvector to Postgres (no new infrastructure)
- Embed all questions with `text-embedding-3-small`
- Enable: similar question retrieval, lesson↔question auto-linking, semantic search

### Phase 4 — Mastery Score Redesign
Khan Academy-style mastery:
- Per-skill levels: Unfamiliar → Familiar → Proficient → Mastered
- Level-up requires streak of correct answers
- Time decay (mastery fades if skill not practiced)
- Minimum 5 questions before showing numeric mastery
- Confidence indicator based on question count

### Phase 5 — Practice Tests
Full timed SAT-format practice tests.

---

## Phase 1: Question Normalization Plan

### Background
Questions are stored in the DB with HTML in three fields:
- `prompt_html` — question text (stimulus prepended if present)
- `choices_json` — JSONB array of HTML strings (MCQ only)
- `explanation_html` — CB rationale HTML

All three fields contain `<img class="math-img" alt="natural language description">` tags for
math expressions (College Board's accessibility format). Currently `preprocessMathHTML()` in
`mathImageUtils.js` converts these client-side via regex (~90% accuracy).

Real diagram/graph/table images are also embedded as `<img>` tags and may render with incorrect
sizing (CB sometimes hardcodes pixel dimensions that overflow or shrink the image).

### Goals
1. **Math images → LaTeX** — Replace every `<img class="math-img" alt="...">` with `<span>\(LATEX\)</span>` using Claude API for accuracy. Store clean HTML in DB so no client-side preprocessing is needed.
2. **Real image sizing** — Strip hardcoded `width`/`height` attributes from non-math images; replace with CSS-driven responsive sizing.
3. **Remove client-side preprocessor** — Once migration is complete, delete `preprocessMathHTML` and its call sites in `QuestionDisplay.jsx` and `AnswerChoice.jsx`.

### Script: `backend/scripts/normalize_questions.py`

**Step 1 — Collect all unique math alt texts**
- Load all questions from DB
- Parse `prompt_html`, each element of `choices_json`, and `explanation_html` with BeautifulSoup
- Find every `<img class="math-img" alt="...">`, collect alt text
- Deduplicate — many alt texts repeat across questions (estimated ~60% dedup ratio)
- Output: `{alt_text: latex}` mapping (built incrementally, cached to JSON on disk so reruns are cheap)

**Step 2 — Batch translate with Claude API**
- System prompt: "You are a LaTeX converter. Convert each College Board math accessibility alt text to LaTeX. Return only the LaTeX string, nothing else. Do not wrap in delimiters."
- Batch size: 50 alt texts per API call (send as numbered list, parse numbered response)
- Model: `claude-haiku-4-5` (fast, cheap — these are short conversions)
- Estimated cost: ~$1–3 for full question bank (deduplication reduces volume significantly)
- Save mapping to `backend/data/math_alt_cache.json` (idempotent reruns)

**Step 3 — Apply to HTML**
For each question, for each HTML field:
- Parse with BeautifulSoup
- Replace each `<img class="math-img">` with `<span class="math-inline">\(LATEX\)</span>`
  - If alt starts with "open brace" (system of equations): wrap each equation in a stacked `<div>`
- Strip `width`/`height` attributes from all other `<img>` tags; add `style="max-width:100%;height:auto;"`
- Write cleaned HTML back to `prompt_html`, `choices_json`, `explanation_html`

**Step 4 — Commit to DB**
- Update in batches of 100
- Set `is_verified = False` on updated rows (flag for manual spot-check)
- Log: questions updated, fields changed, any alt texts that failed translation

**Step 5 — Frontend cleanup (after verifying migration)**
- [ ] Remove `preprocessMathHTML` import and calls in `QuestionDisplay.jsx`
- [ ] Remove `preprocessMathHTML` import and calls in `AnswerChoice.jsx`
- [ ] Delete `frontend/src/utils/mathImageUtils.js`
- [ ] Add CSS to `question-content` class: `img { max-width: 100%; height: auto; }`

### Validation
- Spot-check 20 random questions per skill code (math/reading)
- Verify MathJax renders cleanly with no fallback to image tags
- Verify real images scale correctly on mobile viewport
- QC query: count any remaining `<img class="math-img"` in DB after migration

### Files to create/modify
| File | Action |
|------|--------|
| `backend/scripts/normalize_questions.py` | Create — main migration script |
| `backend/data/math_alt_cache.json` | Create — translation cache (gitignored) |
| `frontend/src/components/test/QuestionDisplay.jsx` | Remove `preprocessMathHTML` |
| `frontend/src/components/test/AnswerChoice.jsx` | Remove `preprocessMathHTML` |
| `frontend/src/utils/mathImageUtils.js` | Delete |
| `frontend/src/index.css` or question component | Add responsive img CSS |

---

## Critical (Must Fix Before Launch)

### 1. ~~Database Domain Fix~~ DONE
Fixed Transitions and Rhetorical Synthesis skills domain assignment.

### 2. ~~Email System~~ DONE
SendGrid integration complete. Password reset emails working.

**Setup required on Railway:**
1. Add `SENDGRID_API_KEY=SG.xxxxx` environment variable
2. Redeploy

### 3. ~~Admin Role Protection~~ DONE
Protected IRT calibration endpoints with admin-only access.

### 4. ~~Timer Persistence~~ DONE
Timer now persists when students leave and resume assignments.

### 5. ~~User Settings Persistence~~ DONE
Dark mode and timezone settings persist to localStorage.

---

## Completed Recently

- [x] **Admin Role Protection** - Calibration endpoints now require admin access
- [x] **Timer Persistence** - Students can't exploit timer by refreshing
- [x] **Settings Persistence** - Dark mode and timezone saved to localStorage
- [x] **Adaptive Exit Fix** - Exit button now saves progress without grading
- [x] **Time Limit Display** - Timer only shows when tutor sets a time limit
- [x] **Time Expired Tracking** - Tutors see when students ran out of time
- [x] **Skill Selector** - Beautiful domain/skill selector for adaptive assignments
- [x] **Resume Bug Fix** - Students can't uncheck answers by resuming
- [x] **Dark Mode** - Full dark mode support across all pages
- [x] **Email System** - SendGrid integration for password reset emails
- [x] **Token Refresh** - Auto-refreshes access tokens, users stay logged in for 7 days
- [x] **Remember Me** - Saves email on login page
- [x] **Reference Sheet** - Added to Adaptive Practice
- [x] **Time Tracking** - Tracks actual time per question
- [x] **Profile/Settings/Progress Pages** - All implemented

---

## High Priority

### 6. Better Mastery & Ability Scores
**Description:** Current mastery calculation is confusing and may not feel representative.

**Issues:**
- Mastery formula uses complex theta conversion
- Difficulty cap is harsh (easy questions cap at 55% mastery)
- No time decay for skills not practiced
- Volatile with few questions
- No confidence indicator

**Recommended:**
- [ ] Add "confidence" indicator (low/medium/high based on question count)
- [ ] Show tutors: "Mastery: 72% (based on 8 questions)"
- [ ] Add time decay: skills practiced 30+ days ago should fade
- [ ] Require minimum 5 questions before showing numeric mastery
- [ ] Simplify formula: weighted accuracy by difficulty level

### 7. Skill Lessons Enhancement
**Description:** Lessons exist but could be improved.

**Optional enhancements:**
- [ ] Track lesson completion per student
- [ ] Link lessons from Question Bank and Adaptive Practice
- [ ] Admin interface to create/edit lessons

---

## Medium Priority (Enhancements)

### 8. IRT Recalibration
**Location:** `backend/app/services/irt_calibration.py`

**Current state:** `recalibrate_from_responses()` is a placeholder

**Required:**
- [ ] Implement MMLE or EM algorithm for IRT parameter estimation
- [ ] Schedule periodic recalibration
- [ ] Add admin endpoint to trigger recalibration

---

## Low Priority (Nice to Have)

### AI Math Alt-Text Migration
**Superseded by Phase 1 plan above.** Full details in the "Phase 1: Question Normalization Plan" section.

**Needs:** `ANTHROPIC_API_KEY` on Railway. Estimated cost: $1–3 after deduplication.

---

### 9. Admin Panel
- [ ] Admin dashboard with system stats
- [ ] User management (view/edit/delete)
- [ ] Question management
- [ ] IRT calibration controls
- [ ] Lesson management

### 10. Export Functionality
- [ ] PDF export for assessment results, progress reports
- [ ] CSV export for data analysis

### 11. Advanced Analytics
- [ ] Custom date range selection
- [ ] Student vs class average comparisons
- [ ] Trend analysis
- [ ] Skill gap identification

### 12. Real-Time Features
- [ ] WebSocket for live updates
- [ ] Tutor viewing student progress in real-time

### 13. UI Enhancements
- [ ] Profile picture upload
- [ ] Progress over time charts
- [ ] Achievements/milestones

---

## Environment Variables Checklist

### Backend (Railway)
```env
# Required
DATABASE_URL=postgresql://...
SECRET_KEY=<strong-random-key>
ALLOWED_ORIGINS=https://zooprep.com,https://www.zooprep.com
FRONTEND_URL=https://zooprep.com

# Email (SendGrid)
SENDGRID_API_KEY=SG.xxxxx
FROM_EMAIL=noreply@zooprep.com

# Optional
SENTRY_DSN=
```

### Frontend (Vercel)
```env
REACT_APP_API_URL=https://your-railway-app.up.railway.app/api/v1
```

---

## Quick Reference: File Locations

| Feature | Frontend | Backend |
|---------|----------|---------|
| Authentication | `pages/auth/*` | `api/v1/auth.py` |
| Assignments | `pages/*/AssignmentsPage.jsx` | `api/v1/assignments.py` |
| Questions | `pages/*/QuestionBankPage.jsx` | `api/v1/questions.py` |
| Adaptive | `pages/student/AdaptivePracticePage.jsx` | `api/v1/adaptive.py` |
| IRT | N/A | `services/irt_service.py` |
| Profile | `pages/shared/ProfilePage.jsx` | `api/v1/auth.py` |
| Settings | `pages/shared/SettingsPage.jsx` | localStorage (client-side) |
| Progress | `pages/shared/ProgressPage.jsx` | `api/v1/progress.py` |

---

*Last updated: January 2026*
