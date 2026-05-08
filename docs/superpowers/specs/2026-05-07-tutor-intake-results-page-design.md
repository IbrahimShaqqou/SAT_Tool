# Tutor Intake Results Page

**Date:** 2026-05-07
**Status:** Spec — awaiting review
**Owner:** Frontend (with one backend service change)

## Problem

When a student finishes a tutor-issued intake assessment, the tutor currently views results in a modal popped from `/tutor/invites`. The modal is cramped and surfaces only domain-level performance and a generic top-3 priority list. Tutors need a dedicated page that makes "what to teach next" obvious and provides direct entry points into lessons and practice assignments at the skill level.

## Goals

1. A dedicated route — `/tutor/invites/:inviteId/results` — replacing the existing modal.
2. Per-skill performance breakdown (the current API only exposes per-domain).
3. For each weak skill: a button to view the corresponding lesson (when one exists) and a button to assign targeted practice (prefilled with the student and skill).
4. The page reads as a tutor's diagnostic tool, not a student's score report.

## Non-goals

- PDF export (browser print covers this).
- Email-this-report.
- Comparing one intake to another.
- Tutor notes / annotations on skills.
- A new endpoint or migration.
- Any change to the student-facing `AssessmentResultsPage`.

## Architecture

- **Route:** `/tutor/invites/:inviteId/results` rendered by a new `IntakeResultsPage` under `frontend/src/pages/tutor/`.
- **Auth:** existing `get_current_tutor` dependency; the invite's owning tutor only. Other tutors get 404.
- **Data source:** the existing `GET /tutor/invites/{invite_id}/results` endpoint, extended to include a new `skill_breakdown` array. No new endpoint, no migration.
- **Reused components:** `Card`, `Button`, `Badge`, `ProgressBar`, `LoadingSpinner` from `frontend/src/components/ui/`.
- **Modal removal:** the `Modal` flow on `InvitesPage.jsx` (state, handler, JSX block) is deleted; the table's "View Results" action becomes a `<Link>` to the new route.

## Backend

### Single change — `backend/app/services/intake_service.py`

`calculate_intake_results(db, session_id)` already groups responses per domain. Add a parallel grouping pass per skill, then attach `lesson_id` via one batched query.

New field on the returned dict:

```python
"skill_breakdown": [
    {
        "skill_id": int,
        "skill_name": str,
        "domain_id": int,
        "domain_code": str,
        "domain_name": str,
        "correct": int,
        "total": int,
        "accuracy": float,        # 0–100, rounded to 1 decimal
        "lesson_id": Optional[UUID],   # null if no active lesson exists
    }
]
```

Implementation details:
- Iterate `responses`, resolve each `Question.skill_id` and `Question.domain_id`. Skip responses where `skill_id` is null (rare data hygiene case).
- After grouping, run one batched query: `SELECT skill_id, id FROM lessons WHERE skill_id IN (...) AND is_active = true`. Build a `{skill_id -> lesson_id}` dict and attach.
- Skills with zero attempts in this session are not in the array (only skills the student saw).

`backend/app/api/v1/tutor.py:712` (`get_invite_results`) already returns `**results`, so the new field flows through automatically. No change needed in the router.

## Frontend

### New file — `frontend/src/pages/tutor/IntakeResultsPage.jsx`

Single file, ~250 lines. Internal subcomponents kept inside the file because they are not reused elsewhere:

| Subcomponent | Purpose |
|---|---|
| `IntakeResultsPage` (default export) | Route container, fetch, loading/error |
| `Header` | Back link, student name, email, completion timestamp, time-spent |
| `ScoreCard` | Predicted score number, range, accuracy, "Review every question" link |
| `TeachThisNext` | Top-3 weakest skills with Lesson + Assign Practice buttons |
| `DomainBreakdown` | Collapsible domain list with skill rows nested |
| `SkillRow` | One skill: name, fraction, accuracy bar, Lesson + Practice buttons |
| `FooterActions` | Bulk assign top-3, copy summary, view full profile |

Icons (lucide-react, already in the dependency tree):
- `BookOpen` — lesson buttons
- `Zap` — assign-practice buttons
- `ClipboardCopy` — copy summary
- `ChevronDown` / `ChevronRight` — domain collapse/expand
- `ArrowLeft` — back link
- `Printer` — print button
- `User` — view-profile button

### Page layout

```
Header: back link, student name, email, completion timestamp, time spent

Two-column block:
  Left  — Predicted score card (predicted_score_mid, range, accuracy, link to per-question review)
  Right — "Teach this next": top-3 weakest skills with Lesson and Assign Practice buttons

Per-domain performance:
  For each domain in skill_breakdown grouped by domain_id:
    domain header (name, fraction, accuracy bar)
    nested skill rows (sorted accuracy ascending)
    domains with accuracy < 50% open by default; others collapsed

Footer actions:
  - Create assignment for top-3 weak skills (prefills student + skills)
  - Copy summary to clipboard (plain-text composed client-side)
  - View full student profile
```

### State

```js
{
  data,                 // server response
  isLoading: bool,
  error: { kind, message } | null,
  openDomains: Set<domain_id>,   // local-only, not persisted
}
```

Open-by-default rule for `openDomains`: any domain whose aggregate accuracy is below 50% starts open; others start collapsed.

### Top-3 derivation

```js
const weakestThree = [...data.skill_breakdown]
  .filter(s => s.total >= 1)
  .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
  .slice(0, 3);
```

Tie-breaker: among equal accuracies, more attempts wins (a 2/8 ranks worse than a 0/1).

### Skill row rendering

```jsx
{skill.lesson_id && (
  <Link to={`/tutor/lessons/${skill.lesson_id}`}>
    <Button variant="secondary" size="sm">
      <BookOpen className="h-4 w-4 mr-2" />
      Lesson
    </Button>
  </Link>
)}
{data.student_id && (
  <Link to={`/tutor/assignments/new?student=${data.student_id}&skills=${skill.skill_id}`}>
    <Button variant="primary" size="sm">
      <Zap className="h-4 w-4 mr-2" />
      Assign Practice
    </Button>
  </Link>
)}
```

`Lesson` is hidden when `lesson_id` is null. `Assign Practice` is hidden when `student_id` is null (guest invite). When both are hidden, the row shows the metrics only.

### Copy-summary format

Composed client-side from data already on the page; no backend call.

```
{Student Name} — {Subject} Intake ({Completion Date})
Predicted: {score} (range {low}–{high}) • {correct}/{total} correct

Teach next:
- {skill_name}: {correct}/{total} ({accuracy}%)
- {skill_name}: {correct}/{total} ({accuracy}%)
- {skill_name}: {correct}/{total} ({accuracy}%)
```

### Routing

Add to `frontend/src/App.js` inside the existing tutor-protected route block:

```jsx
<Route path="/tutor/invites/:inviteId/results" element={<IntakeResultsPage />} />
```

### Modal removal — `frontend/src/pages/tutor/InvitesPage.jsx`

Delete:
- `showResultsModal`, `selectedResults`, `loadingResults` state
- `handleViewResults` function (lines ~137–149)
- the results `<Modal>` block (lines ~507–656)

Replace the `BarChart3` action button at line ~277 — currently `onClick={() => handleViewResults(row.id)}` — with a `<Link to={`/tutor/invites/${row.id}/results`}>` wrapping the same icon.

### API client

`inviteService.getResults(inviteId)` already exists and is used by the modal. The new page reuses it as-is. No service-layer changes needed.

## Error handling

| Backend response | UI |
|---|---|
| `404 Invite not found` | Card: "This intake assessment doesn't exist or you don't have access." + back button. |
| `400 Assessment not started` | Card: "The student hasn't started this intake yet." + back button. |
| `400 Assessment not completed` | Card: "The student is still working on this intake — results will appear when it's submitted." + back button. |
| Network / 5xx | Card: "Couldn't load results." + Retry button. |

Loading state: full-page centered `LoadingSpinner`, matching `StudentDetailPage.jsx`.

## Edge cases

- **Guest invite (`student_id` is null):** `Assign Practice` and "View full profile" hidden. The page shows an inline note above the score card: "This student hasn't accepted the invite as a registered user yet — assignments are unavailable until they sign up."
- **Skill with no lesson:** `Lesson` button omitted from that row only.
- **Fewer than 3 skills attempted** (e.g., a `quick_check` invite slipped through): `TeachThisNext` renders the skills it has and uses the header "Teach this next" instead of "Top 3 weakest".
- **All skills ≥ 80%:** `TeachThisNext` shows the headline "No weak areas — consider advancing to harder material" and hides the per-skill rows.
- **Skill with zero attempts:** never appears in either Teach This Next or the breakdown (filtered server-side by virtue of grouping over actual responses).
- **Domain with zero skill_breakdown entries:** that domain is skipped in the breakdown.

## Dark mode

Uses the semantic tokens already established across the codebase: `bg-surface-card`, `bg-surface-muted`, `text-ink-body`, `text-ink-subtle`, `text-ink-faint`, `border-edge`, `border-edge-subtle`. No raw `bg-white` / `text-gray-X` classes. Accuracy color coding uses `text-emerald-600 dark:text-emerald-400` / `text-amber-600 dark:text-amber-400` / `text-red-600 dark:text-red-400`. The brand-colored predicted score works in both themes via `text-brand-600 dark:text-brand-400`.

## Print

Minimal `@media print` rules inline in the page file (single consumer):

```css
@media print {
  .no-print { display: none !important; }
}
```

Elements tagged `no-print`: back link, all action buttons (Lesson, Assign Practice, footer actions), the print button itself. The header, score card, Teach This Next list, and full domain breakdown all print.

## Testing

Manual verification flow (no new automated tests in this spec — the page is a thin presentation layer over an extended endpoint):

1. Issue an intake invite, complete it as a student, navigate to `/tutor/invites/:id/results`. Verify score, top-3, and breakdown match the modal that previously existed.
2. Verify a skill with a lesson shows the `Lesson` button and links to `/tutor/lessons/:lessonId`.
3. Verify a skill without a lesson shows only the practice button.
4. Click `Assign Practice` on a skill row — confirm `/tutor/assignments/new` opens with that student and skill prefilled.
5. Issue a guest invite (no signup), complete it — confirm Assign Practice / View Profile are hidden and the guest note shows.
6. Toggle dark mode — confirm no white panels or gray-on-gray text.
7. Browser print preview — confirm buttons hidden, content readable.
8. Old modal flow — confirm the modal is gone from `InvitesPage`; clicking the BarChart3 action navigates instead.

## Files touched

| File | Change |
|---|---|
| `backend/app/services/intake_service.py` | Add `skill_breakdown` to `calculate_intake_results` return |
| `frontend/src/pages/tutor/IntakeResultsPage.jsx` | New file |
| `frontend/src/pages/tutor/index.js` | Export the new page |
| `frontend/src/App.js` | Add route `/tutor/invites/:inviteId/results` |
| `frontend/src/pages/tutor/InvitesPage.jsx` | Delete modal flow; navigate from action button |
