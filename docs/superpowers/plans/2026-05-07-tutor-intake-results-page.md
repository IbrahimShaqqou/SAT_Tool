# Tutor Intake Results Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Operator note:** This repository's user prefers NOT to run git commands automatically. Treat the `git add` / `git commit` steps as proposals — surface them to the user for confirmation before executing.

**Goal:** Replace the existing intake results modal on `/tutor/invites` with a dedicated tutor-facing page at `/tutor/invites/:inviteId/results` that surfaces predicted score, top-3 weakest skills with per-skill lesson and assign-practice CTAs, and a collapsible per-domain skill breakdown.

**Architecture:** One backend service function gains a `skill_breakdown` array (no new endpoint, no migration). One new frontend page consumes the existing `GET /tutor/invites/{id}/results` endpoint. The modal flow on `InvitesPage.jsx` is deleted; the table's "View Results" action navigates instead. The new page has its own components (it does not reuse the student-facing `AssessmentResultsPage`) so tutor copy and CTAs can evolve independently.

**Tech Stack:** FastAPI + SQLAlchemy + Pytest (backend); React + react-router-dom + Tailwind + lucide-react icons + existing `components/ui` primitives (Card, Button, Badge, ProgressBar, LoadingSpinner) (frontend).

**Spec:** `docs/superpowers/specs/2026-05-07-tutor-intake-results-page-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/app/services/intake_service.py` | Modify | Extend `calculate_intake_results` to include `skill_breakdown` |
| `backend/tests/test_intake_service.py` | Create | Unit test for `skill_breakdown` aggregation + `lesson_id` resolution |
| `frontend/src/pages/tutor/IntakeResultsPage.jsx` | Create | New tutor-facing results page (route container + subcomponents in one file) |
| `frontend/src/pages/tutor/index.js` | Modify | Export the new page |
| `frontend/src/App.js` | Modify | Add `/tutor/invites/:inviteId/results` route |
| `frontend/src/pages/tutor/InvitesPage.jsx` | Modify | Delete modal state, handler, JSX block; convert action button to a `<Link>` |

---

## Task 1: Backend — extend `calculate_intake_results` with `skill_breakdown`

**Files:**
- Create: `backend/tests/test_intake_service.py`
- Modify: `backend/app/services/intake_service.py:521-531` (return dict)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_intake_service.py`:

```python
"""
Tests for intake_service.calculate_intake_results — skill_breakdown aggregation.
"""
import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.models.question import Question
from app.models.taxonomy import Domain, Skill
from app.models.test import TestSession
from app.models.response import StudentResponse
from app.models.user import User
from app.models.lesson import Lesson
from app.models.enums import (
    AnswerType, DifficultyLevel, SubjectArea, TestType, TestStatus, UserRole,
)
from app.services.intake_service import calculate_intake_results


@pytest.fixture
def student(db: Session) -> User:
    user = User(
        id=uuid4(),
        email=f"student-{uuid4().hex[:8]}@test.com",
        password_hash="x",
        role=UserRole.STUDENT,
        first_name="Test",
        last_name="Student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def algebra_domain(db: Session) -> Domain:
    d = Domain(
        code="H",
        name="Algebra",
        subject_area=SubjectArea.MATH,
        description="Algebra",
        display_order=1,
        is_active=True,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@pytest.fixture
def linear_skill(db: Session, algebra_domain: Domain) -> Skill:
    s = Skill(
        domain_id=algebra_domain.id,
        code="H.A",
        name="Linear equations",
        description="x",
        display_order=1,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def systems_skill(db: Session, algebra_domain: Domain) -> Skill:
    s = Skill(
        domain_id=algebra_domain.id,
        code="H.B",
        name="Systems of equations",
        description="x",
        display_order=2,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _make_question(db, domain, skill, ext_id):
    q = Question(
        id=uuid4(),
        external_id=ext_id,
        subject_area=SubjectArea.MATH,
        domain_id=domain.id,
        skill_id=skill.id,
        answer_type=AnswerType.MCQ,
        difficulty=DifficultyLevel.MEDIUM,
        prompt_html="<p>q</p>",
        choices_json=["<p>a</p>", "<p>b</p>"],
        correct_answer_json={"index": 0},
        is_active=True,
        is_verified=True,
        irt_discrimination_a=1.0,
        irt_difficulty_b=0.0,
        irt_guessing_c=0.25,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


def _make_session(db, student) -> TestSession:
    s = TestSession(
        id=uuid4(),
        student_id=student.id,
        test_type=TestType.INTAKE,
        status=TestStatus.COMPLETED,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _record_response(db, session, question, is_correct):
    r = StudentResponse(
        id=uuid4(),
        student_id=session.student_id,
        test_session_id=session.id,
        question_id=question.id,
        is_correct=is_correct,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(r)
    db.commit()
    return r


def test_skill_breakdown_groups_responses_by_skill(
    db, student, algebra_domain, linear_skill, systems_skill
):
    """Two skills under the same domain are reported separately with correct counts."""
    session = _make_session(db, student)

    q1 = _make_question(db, algebra_domain, linear_skill, "q1")
    q2 = _make_question(db, algebra_domain, linear_skill, "q2")
    q3 = _make_question(db, algebra_domain, systems_skill, "q3")

    _record_response(db, session, q1, is_correct=True)
    _record_response(db, session, q2, is_correct=False)
    _record_response(db, session, q3, is_correct=True)

    results = calculate_intake_results(db, session.id)

    assert "skill_breakdown" in results
    by_skill = {row["skill_id"]: row for row in results["skill_breakdown"]}

    assert by_skill[linear_skill.id]["correct"] == 1
    assert by_skill[linear_skill.id]["total"] == 2
    assert by_skill[linear_skill.id]["accuracy"] == 50.0
    assert by_skill[linear_skill.id]["skill_name"] == "Linear equations"
    assert by_skill[linear_skill.id]["domain_code"] == "H"
    assert by_skill[linear_skill.id]["domain_name"] == "Algebra"

    assert by_skill[systems_skill.id]["correct"] == 1
    assert by_skill[systems_skill.id]["total"] == 1
    assert by_skill[systems_skill.id]["accuracy"] == 100.0


def test_skill_breakdown_includes_lesson_id_when_lesson_exists(
    db, student, algebra_domain, linear_skill, systems_skill
):
    """skill_breakdown attaches lesson_id only for skills with an active lesson."""
    session = _make_session(db, student)

    q1 = _make_question(db, algebra_domain, linear_skill, "q1")
    q2 = _make_question(db, algebra_domain, systems_skill, "q2")

    lesson = Lesson(
        id=uuid4(),
        skill_id=linear_skill.id,
        domain_id=algebra_domain.id,
        title="Linear Equations Lesson",
        slug="linear-equations",
        is_active=True,
    )
    db.add(lesson)
    db.commit()

    _record_response(db, session, q1, is_correct=True)
    _record_response(db, session, q2, is_correct=True)

    results = calculate_intake_results(db, session.id)
    by_skill = {row["skill_id"]: row for row in results["skill_breakdown"]}

    assert by_skill[linear_skill.id]["lesson_id"] == lesson.id
    assert by_skill[systems_skill.id]["lesson_id"] is None


def test_skill_breakdown_omits_skills_with_zero_attempts(
    db, student, algebra_domain, linear_skill, systems_skill
):
    """Skills the student never saw do not appear."""
    session = _make_session(db, student)
    q = _make_question(db, algebra_domain, linear_skill, "q1")
    _record_response(db, session, q, is_correct=True)

    results = calculate_intake_results(db, session.id)
    skill_ids = {row["skill_id"] for row in results["skill_breakdown"]}

    assert linear_skill.id in skill_ids
    assert systems_skill.id not in skill_ids
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && pytest tests/test_intake_service.py -v
```

Expected: 3 tests FAIL with `KeyError: 'skill_breakdown'` or similar (the field doesn't exist yet).

- [ ] **Step 3: Add Lesson import and skill aggregation block**

In `backend/app/services/intake_service.py`, find the imports near the top of the file. Add:

```python
from app.models.lesson import Lesson
```

(Place it alongside the other model imports — `Domain`, `Question`, etc. — wherever they live.)

Then in `calculate_intake_results`, after the existing per-domain grouping loop and before the existing `return {...}` block (around line 521), insert the per-skill aggregation:

```python
    # Group responses by skill (parallel to the per-domain grouping above)
    skill_groups: Dict[int, Dict[str, Any]] = {}
    for r in responses:
        q = db.query(Question).filter(Question.id == r.question_id).first()
        if not q or not q.skill_id:
            continue
        sid = q.skill_id
        if sid not in skill_groups:
            skill_groups[sid] = {
                "skill_id": sid,
                "domain_id": q.domain_id,
                "correct": 0,
                "total": 0,
            }
        skill_groups[sid]["total"] += 1
        if r.is_correct:
            skill_groups[sid]["correct"] += 1

    # Resolve skill metadata + active lesson_id in two batched queries
    skill_ids = list(skill_groups.keys())
    skills_by_id: Dict[int, Skill] = {}
    lesson_by_skill: Dict[int, Any] = {}
    if skill_ids:
        skills = db.query(Skill).filter(Skill.id.in_(skill_ids)).all()
        skills_by_id = {s.id: s for s in skills}

        lessons = db.query(Lesson).filter(
            Lesson.skill_id.in_(skill_ids),
            Lesson.is_active == True,  # noqa: E712
        ).all()
        lesson_by_skill = {l.skill_id: l.id for l in lessons}

    # Build the breakdown array (skills the student actually saw)
    skill_breakdown = []
    for sid, g in skill_groups.items():
        skill = skills_by_id.get(sid)
        if not skill:
            continue
        domain = db.query(Domain).filter(Domain.id == g["domain_id"]).first() if g["domain_id"] else None
        skill_breakdown.append({
            "skill_id": sid,
            "skill_name": skill.name,
            "domain_id": g["domain_id"],
            "domain_code": domain.code if domain else "",
            "domain_name": domain.name if domain else "",
            "correct": g["correct"],
            "total": g["total"],
            "accuracy": round(g["correct"] / g["total"] * 100, 1) if g["total"] > 0 else 0,
            "lesson_id": lesson_by_skill.get(sid),
        })
```

Add the new key to the existing `return {...}` (which currently ends at line ~531):

```python
    return {
        "overall": {
            "correct": all_correct,
            "total": all_total,
            "accuracy": round(all_correct / all_total * 100, 1) if all_total > 0 else 0,
        },
        "section_abilities": list(section_abilities.values()),
        "domain_abilities": list(domain_abilities.values()),
        "priority_areas": priority_areas,
        "predicted_composite": _calculate_composite_score(section_abilities),
        "skill_breakdown": skill_breakdown,   # <-- new
    }
```

Make sure `Skill` is already imported in this file (it is — confirm via the existing per-domain logic which uses `Domain`; `Skill` may need to be added). If missing, add to existing import line:

```python
from app.models.taxonomy import Domain, Skill
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_intake_service.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Sanity-run the broader tutor test suite to ensure no regression**

```bash
cd backend && pytest tests/test_tutor.py -v
```

Expected: existing tests continue to PASS (the new field is additive, ignored by existing assertions).

- [ ] **Step 6: Propose commit**

```bash
git add backend/app/services/intake_service.py backend/tests/test_intake_service.py
git commit -m "feat(intake): add skill_breakdown to intake results"
```

---

## Task 2: Frontend — scaffold `IntakeResultsPage` with route, fetch, loading & error shells

**Files:**
- Create: `frontend/src/pages/tutor/IntakeResultsPage.jsx`
- Modify: `frontend/src/pages/tutor/index.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create the page skeleton**

Create `frontend/src/pages/tutor/IntakeResultsPage.jsx`:

```jsx
/**
 * Tutor-facing intake assessment results page.
 * Replaces the modal flow on InvitesPage. Subcomponents are kept inline
 * because they are not reused elsewhere.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import {
  Card,
  Button,
  LoadingSpinner,
} from '../../components/ui';
import { inviteService } from '../../services';

const IntakeResultsPage = () => {
  const { inviteId } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await inviteService.getResults(inviteId);
        if (!cancelled) setData(response.data);
      } catch (err) {
        if (cancelled) return;
        const status = err.response?.status;
        const detail = err.response?.data?.detail;
        if (status === 404) {
          setError({ kind: 'not_found', message: "This intake assessment doesn't exist or you don't have access." });
        } else if (status === 400 && detail === 'Assessment not started') {
          setError({ kind: 'not_started', message: "The student hasn't started this intake yet." });
        } else if (status === 400 && detail === 'Assessment not completed') {
          setError({ kind: 'in_progress', message: "The student is still working on this intake — results will appear when it's submitted." });
        } else {
          setError({ kind: 'unknown', message: "Couldn't load results." });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchResults();
    return () => { cancelled = true; };
  }, [inviteId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/tutor/invites">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Intake Assessments
          </Button>
        </Link>
        <Card>
          <div className="text-center py-8 space-y-4">
            <p className="text-ink-body">{error.message}</p>
            {error.kind === 'unknown' && (
              <Button variant="primary" onClick={() => window.location.reload()}>
                Retry
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/tutor/invites" className="no-print">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Intake Assessments
        </Button>
      </Link>
      {/* Header / ScoreCard / TeachThisNext / DomainBreakdown / FooterActions added in later tasks */}
      <pre className="text-xs text-ink-subtle">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default IntakeResultsPage;
```

- [ ] **Step 2: Export from the tutor pages barrel**

In `frontend/src/pages/tutor/index.js`, add:

```js
export { default as IntakeResultsPage } from './IntakeResultsPage';
```

(Place alongside other named exports in that file.)

- [ ] **Step 3: Register the route**

In `frontend/src/App.js`, find the existing tutor-protected route block (where `/tutor/invites` is registered). Import the new page near the other tutor imports:

```js
import IntakeResultsPage from './pages/tutor/IntakeResultsPage';
```

Then add this `<Route>` next to the other tutor routes:

```jsx
<Route path="/tutor/invites/:inviteId/results" element={<IntakeResultsPage />} />
```

- [ ] **Step 4: Verify in the browser**

Run the dev server (if not already running):

```bash
cd frontend && npm start
```

Log in as a tutor with at least one completed intake. Navigate manually to `/tutor/invites/<id>/results`. Confirm:
- Loading spinner shows briefly
- Raw JSON dump appears (the data shape includes `score_percentage`, `section_abilities`, `domain_abilities`, `skill_breakdown`)
- Hitting a bogus UUID shows the "doesn't exist" card

- [ ] **Step 5: Propose commit**

```bash
git add frontend/src/pages/tutor/IntakeResultsPage.jsx frontend/src/pages/tutor/index.js frontend/src/App.js
git commit -m "feat(tutor): scaffold IntakeResultsPage with fetch + error shells"
```

---

## Task 3: Frontend — Header + ScoreCard subcomponents

**Files:**
- Modify: `frontend/src/pages/tutor/IntakeResultsPage.jsx`

- [ ] **Step 1: Add date formatting helper and Header subcomponent**

At the top of `IntakeResultsPage.jsx`, after imports, add:

```jsx
const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '';
  const m = Math.round(seconds / 60);
  return `${m} min`;
};

const Header = ({ data, onPrint }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 className="text-2xl font-semibold text-ink-body">
        {data.student_name || 'Guest Student'}
        <span className="text-ink-subtle font-normal"> — Intake</span>
      </h1>
      <p className="text-sm text-ink-subtle mt-1">
        {data.student_email && <span>{data.student_email} · </span>}
        Completed {formatDateTime(data.completed_at)}
        {data.time_spent_seconds ? ` · ${formatDuration(data.time_spent_seconds)}` : ''}
      </p>
    </div>
    <Button variant="secondary" size="sm" onClick={onPrint} className="no-print">
      <Printer className="h-4 w-4 mr-2" />
      Print
    </Button>
  </div>
);
```

- [ ] **Step 2: Add the ScoreCard subcomponent**

Add this above the `IntakeResultsPage` component:

```jsx
const ScoreCard = ({ data }) => {
  const section = data.section_abilities?.[0];
  const overall = data.overall || { correct: 0, total: 0, accuracy: 0 };

  if (!section) {
    return (
      <Card>
        <p className="text-sm text-ink-subtle">No score available.</p>
      </Card>
    );
  }

  const sectionLabel = section.section === 'math' ? 'Math' : 'Reading & Writing';

  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
        Predicted {sectionLabel} Score
      </p>
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-bold text-brand-600 dark:text-brand-400">
          {section.predicted_score_mid}
        </span>
        <span className="text-sm text-ink-subtle">
          range {section.predicted_score_low}–{section.predicted_score_high}
        </span>
      </div>
      <p className="text-sm text-ink-muted mt-3">
        {overall.correct}/{overall.total} correct ({overall.accuracy}%)
      </p>
      {data.student_id && data.test_session_id && (
        <Link
          to={`/tutor/students/${data.student_id}/results/${data.test_session_id}`}
          className="inline-flex items-center text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline mt-4 no-print"
        >
          Review every question →
        </Link>
      )}
    </Card>
  );
};
```

- [ ] **Step 3: Wire Header + ScoreCard into the main render**

Replace the JSON `<pre>` placeholder in `IntakeResultsPage`'s success render with:

```jsx
return (
  <div className="space-y-6">
    <Link to="/tutor/invites" className="no-print">
      <Button variant="ghost" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Intake Assessments
      </Button>
    </Link>
    <Header data={data} onPrint={() => window.print()} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ScoreCard data={data} />
      {/* TeachThisNext goes here in Task 4 */}
    </div>
  </div>
);
```

- [ ] **Step 4: Verify in the browser**

Reload the page. Confirm the header shows student name + email + completion time, the score card shows a big bold number with the range and accuracy line, and the "Review every question" link goes to the existing tutor results page.

- [ ] **Step 5: Propose commit**

```bash
git add frontend/src/pages/tutor/IntakeResultsPage.jsx
git commit -m "feat(tutor): add Header and ScoreCard to intake results"
```

---

## Task 4: Frontend — TeachThisNext subcomponent

**Files:**
- Modify: `frontend/src/pages/tutor/IntakeResultsPage.jsx`

- [ ] **Step 1: Add the imports needed**

At the top of the file, extend the lucide-react import to include `BookOpen` and `Zap`:

```js
import { ArrowLeft, Printer, BookOpen, Zap } from 'lucide-react';
```

- [ ] **Step 2: Add a helper to derive the weakest skills**

Above the `IntakeResultsPage` component:

```jsx
const pickWeakestSkills = (skillBreakdown, count = 3) =>
  [...(skillBreakdown || [])]
    .filter((s) => s.total >= 1)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, count);

const ALL_STRONG_THRESHOLD = 80;
```

- [ ] **Step 3: Add the SkillCtaButtons subcomponent (reused in Tasks 4 and 5)**

Above the `IntakeResultsPage` component:

```jsx
const SkillCtaButtons = ({ skill, studentId }) => (
  <div className="flex gap-2 flex-wrap">
    {skill.lesson_id && (
      <Link to={`/tutor/lessons/${skill.lesson_id}`} className="no-print">
        <Button variant="secondary" size="sm">
          <BookOpen className="h-4 w-4 mr-2" />
          Lesson
        </Button>
      </Link>
    )}
    {studentId && (
      <Link
        to={`/tutor/assignments/new?student=${studentId}&skills=${skill.skill_id}`}
        className="no-print"
      >
        <Button variant="primary" size="sm">
          <Zap className="h-4 w-4 mr-2" />
          Assign Practice
        </Button>
      </Link>
    )}
  </div>
);
```

- [ ] **Step 4: Add the TeachThisNext subcomponent**

Above the `IntakeResultsPage` component:

```jsx
const accuracyToneClass = (accuracy) =>
  accuracy >= 70
    ? 'text-emerald-600 dark:text-emerald-400'
    : accuracy >= 50
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

const TeachThisNext = ({ data }) => {
  const allStrong =
    (data.skill_breakdown || []).length > 0 &&
    (data.skill_breakdown || []).every((s) => s.accuracy >= ALL_STRONG_THRESHOLD);

  if (allStrong) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
          Teach this next
        </p>
        <p className="text-ink-body">
          No weak areas — consider advancing to harder material.
        </p>
      </Card>
    );
  }

  const weakest = pickWeakestSkills(data.skill_breakdown);

  if (weakest.length === 0) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
          Teach this next
        </p>
        <p className="text-ink-subtle">No skill data available.</p>
      </Card>
    );
  }

  const heading = weakest.length === 3 ? 'Top 3 weakest skills' : 'Teach this next';

  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-ink-subtle mb-3">
        {heading}
      </p>
      <ol className="space-y-4">
        {weakest.map((skill, idx) => (
          <li key={skill.skill_id} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="font-medium text-ink-body">
                {idx + 1}. {skill.skill_name}
              </span>
              <span className={`text-sm font-semibold ${accuracyToneClass(skill.accuracy)}`}>
                {skill.correct}/{skill.total} ({skill.accuracy}%)
              </span>
            </div>
            <SkillCtaButtons skill={skill} studentId={data.student_id} />
          </li>
        ))}
      </ol>
    </Card>
  );
};
```

- [ ] **Step 5: Render TeachThisNext in the grid**

In the main return of `IntakeResultsPage`, replace the `{/* TeachThisNext goes here */}` comment with:

```jsx
<TeachThisNext data={data} />
```

- [ ] **Step 6: Verify in the browser**

Reload. Confirm the right column shows up to 3 weakest skills, ordered worst-first, with appropriately colored accuracy text. For a skill with a lesson, the "Lesson" button appears; for a skill without one, only "Assign Practice" appears. Click "Assign Practice" — confirm the assignment-new page loads with `student=<id>&skills=<skillId>` in the URL.

- [ ] **Step 7: Propose commit**

```bash
git add frontend/src/pages/tutor/IntakeResultsPage.jsx
git commit -m "feat(tutor): add TeachThisNext to intake results"
```

---

## Task 5: Frontend — DomainBreakdown + SkillRow (collapsible per-domain list)

**Files:**
- Modify: `frontend/src/pages/tutor/IntakeResultsPage.jsx`

- [ ] **Step 1: Extend the lucide-react import**

```js
import { ArrowLeft, Printer, BookOpen, Zap, ChevronDown, ChevronRight } from 'lucide-react';
```

- [ ] **Step 2: Add the SkillRow subcomponent**

Above the `IntakeResultsPage` component:

```jsx
const SkillRow = ({ skill, studentId }) => (
  <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-surface-muted">
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink-body truncate">{skill.skill_name}</p>
      <p className={`text-xs ${accuracyToneClass(skill.accuracy)}`}>
        {skill.correct}/{skill.total} ({skill.accuracy}%)
      </p>
    </div>
    <SkillCtaButtons skill={skill} studentId={studentId} />
  </div>
);
```

- [ ] **Step 3: Add a helper to group skills by domain**

Above `IntakeResultsPage`:

```jsx
const groupSkillsByDomain = (skillBreakdown) => {
  const groups = new Map();
  for (const skill of skillBreakdown || []) {
    const key = skill.domain_id;
    if (!groups.has(key)) {
      groups.set(key, {
        domain_id: skill.domain_id,
        domain_code: skill.domain_code,
        domain_name: skill.domain_name,
        skills: [],
        correct: 0,
        total: 0,
      });
    }
    const g = groups.get(key);
    g.skills.push(skill);
    g.correct += skill.correct;
    g.total += skill.total;
  }
  // Sort skills inside each domain by accuracy ascending; sort domains by accuracy ascending too.
  for (const g of groups.values()) {
    g.skills.sort((a, b) => a.accuracy - b.accuracy);
    g.accuracy = g.total > 0 ? Math.round((g.correct / g.total) * 1000) / 10 : 0;
  }
  return [...groups.values()].sort((a, b) => a.accuracy - b.accuracy);
};
```

- [ ] **Step 4: Add the DomainBreakdown subcomponent**

Above `IntakeResultsPage`:

```jsx
const DomainBreakdown = ({ data }) => {
  const grouped = groupSkillsByDomain(data.skill_breakdown);
  const initiallyOpen = new Set(grouped.filter((g) => g.accuracy < 50).map((g) => g.domain_id));
  const [openDomains, setOpenDomains] = useState(initiallyOpen);

  const toggle = (domainId) => {
    setOpenDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  };

  if (grouped.length === 0) {
    return null;
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-ink-subtle mb-3">
        Per-domain performance
      </p>
      <div className="divide-y divide-edge-subtle">
        {grouped.map((g) => {
          const isOpen = openDomains.has(g.domain_id);
          const Icon = isOpen ? ChevronDown : ChevronRight;
          return (
            <div key={g.domain_id} className="py-2">
              <button
                type="button"
                onClick={() => toggle(g.domain_id)}
                className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-ink-subtle flex-shrink-0" />
                  <span className="font-medium text-ink-body truncate">{g.domain_name}</span>
                </span>
                <span className={`text-sm font-semibold ${accuracyToneClass(g.accuracy)}`}>
                  {g.correct}/{g.total} ({g.accuracy}%)
                </span>
              </button>
              {isOpen && (
                <div className="pl-6 pt-1 pb-2 space-y-1">
                  {g.skills.map((skill) => (
                    <SkillRow key={skill.skill_id} skill={skill} studentId={data.student_id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
```

- [ ] **Step 5: Render `DomainBreakdown` in the page**

In the main return of `IntakeResultsPage`, after the two-column grid:

```jsx
<DomainBreakdown data={data} />
```

- [ ] **Step 6: Verify in the browser**

Reload. Confirm:
- Domains are listed worst-accuracy-first
- Domains under 50% are open by default
- Click a chevron to expand/collapse
- Each skill row shows fraction + accuracy + Lesson (if exists) + Assign Practice (if student_id)

- [ ] **Step 7: Propose commit**

```bash
git add frontend/src/pages/tutor/IntakeResultsPage.jsx
git commit -m "feat(tutor): add DomainBreakdown and SkillRow to intake results"
```

---

## Task 6: Frontend — FooterActions (bulk assign, copy summary, view profile)

**Files:**
- Modify: `frontend/src/pages/tutor/IntakeResultsPage.jsx`

- [ ] **Step 1: Extend the lucide-react import**

```js
import { ArrowLeft, Printer, BookOpen, Zap, ChevronDown, ChevronRight, ClipboardCopy, User } from 'lucide-react';
```

- [ ] **Step 2: Add a helper to compose the clipboard summary**

Above `IntakeResultsPage`:

```jsx
const buildSummary = (data) => {
  const section = data.section_abilities?.[0];
  const sectionLabel = section?.section === 'math' ? 'Math' : 'Reading & Writing';
  const date = data.completed_at
    ? new Date(data.completed_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : '';
  const overall = data.overall || { correct: 0, total: 0 };
  const weakest = pickWeakestSkills(data.skill_breakdown);

  const lines = [
    `${data.student_name || 'Student'} — ${sectionLabel} Intake (${date})`,
    section
      ? `Predicted: ${section.predicted_score_mid} (range ${section.predicted_score_low}–${section.predicted_score_high}) · ${overall.correct}/${overall.total} correct`
      : `${overall.correct}/${overall.total} correct`,
    '',
    'Teach next:',
    ...weakest.map((s) => `- ${s.skill_name}: ${s.correct}/${s.total} (${s.accuracy}%)`),
  ];
  return lines.join('\n');
};
```

- [ ] **Step 3: Add the FooterActions subcomponent**

Above `IntakeResultsPage`:

```jsx
const FooterActions = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const weakest = pickWeakestSkills(data.skill_breakdown);
  const top3SkillIds = weakest.map((s) => s.skill_id).join(',');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  return (
    <Card className="no-print">
      <div className="flex flex-wrap gap-3">
        {data.student_id && weakest.length > 0 && (
          <Link to={`/tutor/assignments/new?student=${data.student_id}&skills=${top3SkillIds}`}>
            <Button variant="primary">
              <Zap className="h-4 w-4 mr-2" />
              Create assignment for top {weakest.length} weak skill{weakest.length === 1 ? '' : 's'}
            </Button>
          </Link>
        )}
        <Button variant="secondary" onClick={handleCopy}>
          <ClipboardCopy className="h-4 w-4 mr-2" />
          {copied ? 'Copied!' : 'Copy summary'}
        </Button>
        {data.student_id && (
          <Link to={`/tutor/students/${data.student_id}`}>
            <Button variant="secondary">
              <User className="h-4 w-4 mr-2" />
              View full profile
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
};
```

- [ ] **Step 4: Render FooterActions in the page**

After `<DomainBreakdown />`:

```jsx
<FooterActions data={data} />
```

- [ ] **Step 5: Verify in the browser**

Reload and confirm:
- "Create assignment for top 3 weak skills" links to `/tutor/assignments/new?student=…&skills=<comma-list>`
- "Copy summary" puts a multi-line text on the clipboard (paste somewhere to verify)
- "View full profile" navigates to `/tutor/students/<id>`
- For guest invites (no `student_id`), only "Copy summary" is shown

- [ ] **Step 6: Propose commit**

```bash
git add frontend/src/pages/tutor/IntakeResultsPage.jsx
git commit -m "feat(tutor): add FooterActions to intake results"
```

---

## Task 7: Frontend — print stylesheet + guest invite note

**Files:**
- Modify: `frontend/src/pages/tutor/IntakeResultsPage.jsx`

- [ ] **Step 1: Add the print rule and a guest-invite note**

At the top of the rendered tree (just under the back link, before `Header`), inject a `<style>` tag with a single rule, plus a conditional notice when `data.student_id` is missing:

```jsx
<style>{`@media print { .no-print { display: none !important; } }`}</style>

{!data.student_id && (
  <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
    <p className="text-sm text-amber-800 dark:text-amber-200">
      This student hasn't accepted the invite as a registered user yet — assignments and full-profile actions are unavailable until they sign up.
    </p>
  </Card>
)}
```

- [ ] **Step 2: Verify in the browser**

- Open the page for a registered student → confirm no amber notice.
- Open the page for a guest invite (no `student_id`) → confirm the amber notice and that Assign Practice / View profile buttons are absent.
- Open browser print preview (Cmd+P) → confirm: back link, Print button, Lesson buttons, Assign Practice buttons, footer card are all hidden. The header, ScoreCard, TeachThisNext, and DomainBreakdown content remain.

- [ ] **Step 3: Propose commit**

```bash
git add frontend/src/pages/tutor/IntakeResultsPage.jsx
git commit -m "feat(tutor): add print stylesheet and guest-invite note"
```

---

## Task 8: Frontend — remove modal flow from `InvitesPage`

**Files:**
- Modify: `frontend/src/pages/tutor/InvitesPage.jsx`

- [ ] **Step 1: Replace the action-button onClick with a `<Link>`**

In `frontend/src/pages/tutor/InvitesPage.jsx`, the `actions` column currently renders (around line 277–286):

```jsx
{row.status === 'used' && row.score_percentage != null && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleViewResults(row.id)}
    title="View Results"
  >
    <BarChart3 className="h-4 w-4 text-brand-500 dark:text-brand-400" />
  </Button>
)}
```

Replace with:

```jsx
{row.status === 'used' && row.score_percentage != null && (
  <Link to={`/tutor/invites/${row.id}/results`} title="View Results">
    <Button variant="ghost" size="sm">
      <BarChart3 className="h-4 w-4 text-brand-500 dark:text-brand-400" />
    </Button>
  </Link>
)}
```

- [ ] **Step 2: Delete the modal state + handler**

Remove these lines from the state declarations near the top of the component:

```js
const [showResultsModal, setShowResultsModal] = useState(false);
const [selectedResults, setSelectedResults] = useState(null);
const [loadingResults, setLoadingResults] = useState(false);
```

Remove the entire `handleViewResults` function:

```js
const handleViewResults = async (inviteId) => {
  setLoadingResults(true);
  setShowResultsModal(true);
  try {
    const response = await inviteService.getResults(inviteId);
    setSelectedResults(response.data);
  } catch (error) {
    console.error('Failed to fetch results:', error);
    setSelectedResults({ error: 'Failed to load results' });
  } finally {
    setLoadingResults(false);
  }
};
```

- [ ] **Step 3: Delete the entire results `<Modal>` JSX block**

Remove the full block starting at the comment `{/* Results Modal */}` and ending at its closing `</Modal>`. This is roughly lines 507–656 — the block beginning with:

```jsx
{/* Results Modal */}
<Modal
  isOpen={showResultsModal}
  ...
```

and ending with the matching `</Modal>`.

- [ ] **Step 4: Clean up unused imports**

Inspect the imports at the top of `InvitesPage.jsx`. After deletion, the following may now be unused — remove only the ones that no longer appear anywhere else in the file:

- From `lucide-react`: `BarChart3` is still used (the action button) — keep it. `FileSearch`, `User` may now be unused.
- From `../../components/ui`: `ProgressBar` may now be unused. `Modal` may still be used by the "Generate Modal" — keep it if so.

Verify by grep before removing anything:

```bash
grep -nE "ProgressBar|FileSearch\b|User\b" frontend/src/pages/tutor/InvitesPage.jsx
```

Remove only symbols that have zero remaining references.

- [ ] **Step 5: Confirm the production build is clean**

```bash
cd frontend && npm run build
```

Expected: `Compiled successfully.` No warnings about unused imports.

- [ ] **Step 6: Verify in the browser**

Reload `/tutor/invites`. Confirm:
- The "View Results" icon button on each completed-invite row navigates to `/tutor/invites/<id>/results` (no modal pops)
- All other invite actions (Copy link, Revoke, Generate) still work
- The Generate Modal (separate modal) still opens correctly

- [ ] **Step 7: Propose commit**

```bash
git add frontend/src/pages/tutor/InvitesPage.jsx
git commit -m "refactor(tutor): remove intake results modal in favor of dedicated page"
```

---

## Task 9: Manual verification

**Files:** none (manual testing only)

- [ ] **Step 1: Walk the happy path**

  - Issue an intake invite via `/tutor/invites`
  - Complete it as a student (use a real student account or accept the link in a private window)
  - Return to `/tutor/invites`, click the "View Results" icon
  - Confirm: header, ScoreCard with predicted score, TeachThisNext (top 3), DomainBreakdown (some domains open, others collapsed), FooterActions

- [ ] **Step 2: Verify per-skill CTAs**

  - In the breakdown, find a skill with a lesson — click "Lesson", confirm `/tutor/lessons/<id>` loads correctly.
  - Click "Assign Practice" on a skill — confirm `/tutor/assignments/new?student=<id>&skills=<id>` loads with that skill pre-selected.
  - Click footer "Create assignment for top 3 weak skills" — confirm the assignment-new page shows three skills selected.

- [ ] **Step 3: Verify guest invite flow**

  - Generate a guest-style intake (a flow that ends with `student_id` null, e.g. an unclaimed invite)
  - Complete it as a guest
  - Open the new page — confirm: amber guest notice appears; no Assign Practice / View profile buttons; ScoreCard still renders.

- [ ] **Step 4: Verify error states**

  - Visit `/tutor/invites/00000000-0000-0000-0000-000000000000/results` — expect "doesn't exist" card.
  - Visit a results URL for an invite whose session is in progress (if available) — expect the "still working" card.

- [ ] **Step 5: Verify dark mode**

  - Toggle dark mode (existing theme switch).
  - Confirm: no white panels, no gray-on-gray text, accuracy color coding remains legible.

- [ ] **Step 6: Verify print**

  - From the page, hit Cmd+P (or browser Print).
  - Confirm: back link, Print button, all `Lesson`/`Assign Practice` buttons, and the footer card are hidden in the print preview. The score card, TeachThisNext list, and DomainBreakdown content remain.

- [ ] **Step 7: Final regression check**

  - Visit `/tutor/invites` — confirm the page still renders and all unrelated actions (Copy link, Revoke, Generate New Link, Generate Modal) still work.
  - Issue a brand-new invite — confirm the existing Generate Modal still opens and submits.

---

## Self-Review Notes

Coverage check against the spec:

| Spec section | Plan task |
|---|---|
| Architecture / new route | Task 2 |
| Backend `skill_breakdown` field | Task 1 |
| Header subcomponent | Task 3 |
| ScoreCard subcomponent | Task 3 |
| TeachThisNext subcomponent | Task 4 |
| SkillCtaButtons (Lesson + Assign Practice) | Task 4 (introduced), Task 5 (reused) |
| DomainBreakdown subcomponent | Task 5 |
| SkillRow subcomponent | Task 5 |
| FooterActions (bulk assign + copy + profile) | Task 6 |
| Print stylesheet | Task 7 |
| Guest-invite note | Task 7 |
| Modal removal on InvitesPage | Task 8 |
| Error handling (404, 400 not_started, 400 not_completed, network) | Task 2 |
| Loading state | Task 2 |
| Dark mode tokens | Used throughout, verified Task 9 |
| Manual verification | Task 9 |

No task references types, methods, or properties not defined in either an earlier task or the spec. The `inviteService.getResults` method already exists in the codebase (used by the modal we're replacing).
