# Mastery Score Redesign
**Date:** 2026-04-16

---

## Context

The mastery system has two parallel representations that are used inconsistently across pages:
1. A legacy 0–100% percentage (`mastery_level` float) — shown on the Dashboard and Adaptive Practice results
2. A 4-level enum (`mastery_level_enum`: Not Started / Familiar / Proficient / Mastered) — shown on the Progress Page and Tutor view

Neither surface shows the IRT theta score (−3 to +3) to students, even though the backend calculates it and it provides the most precise picture of ability. The redesign unifies these into one coherent display: a **theta progress bar with level zone bands**, shown consistently across all four pages for both students and tutors.

---

## Level Thresholds (from IRT service)

| Level | Enum | Theta boundary | Requirements |
|-------|------|----------------|--------------|
| Not Started | 0 | — | No responses |
| Familiar | 1 | θ < 0 | 3+ responses, ≥50% accuracy |
| Proficient | 2 | θ ≥ 0.0 | 5+ responses, ≥70% medium accuracy |
| Mastered | 3 | θ ≥ 1.0 | 8+ responses, ≥80% hard accuracy, practiced within 14 days |

Decay: Mastered → Proficient after 14 days inactivity; Proficient → Familiar after 30 days.

---

## New Component: `ThetaBar`

**File:** `frontend/src/components/ui/ThetaBar.jsx`

### Props
```jsx
<ThetaBar
  theta={number | null}          // IRT ability estimate (−3 to +3), null = Not Started
  masteryLevel={0 | 1 | 2 | 3}  // mastery_level_enum from backend
  se={number | null}             // Standard error (tutor view only)
  isStale={boolean}              // Whether mastery needs review
  size="compact" | "full"        // compact ~160px, full = 100%
  showSE={boolean}               // Default false (students); true for tutors
/>
```

### Visual anatomy

```
Proficient  (θ 0.6)
[──────────blue──────│────green────●────│─────gold──────]
−3                   0                  1               +3
```

- **Three colored bands** separated by tick marks at 0 and 1.0:
  - `−3 → 0`: blue (Familiar zone)
  - `0 → 1`: emerald (Proficient zone)
  - `1 → +3`: yellow/gold (Mastered zone)
- **Circular marker (●)** positioned at current theta value
- **Theta value** printed at the marker: `θ 0.6`
- **Level label** above-left in the level's color (from `masteryLevel` enum, not just theta position)
- **Stale state**: entire bar tinted orange, label reads "Needs Review"
- **Not Started** (theta = null): bar fully gray, dashed border, no marker, label "Not Started"

### Key design detail: marker vs label divergence
The marker position reflects raw theta; the level label reflects the enum. These can diverge (e.g., theta = 0.5 in the green zone but level = Familiar because medium-question count is insufficient). This is intentional — it shows students that their ability is ahead of their demonstrated level, and motivates answering more medium-difficulty questions.

### Tutor-only additions (when `showSE={true}`)
- Theta shown as `θ 0.6 ± 0.3`
- If SE > 0.5: small warning indicator (e.g., faint "low confidence" label) — the estimate is imprecise and more data is needed
- If theta is null: shows "0 responses" instead of SE

---

## Updated Components

### `SkillMasteryRow` (in `MasteryBadge.jsx`)
Replace the level icon badge on the left with the compact `ThetaBar` inline:

**Before:**
```
[icon] Skill Name                    Proficient · 78% · 12q · 3d ago
```

**After:**
```
Skill Name                                         Proficient · 12q · 3d ago
[──blue──│────green────●────│─gold─]   θ 0.6
```

The accuracy percentage is removed from the row (it's a downstream artifact of the mastery calculation, not an independent signal). Response count and recency stay.

### `MasteryProgressCard` (in `MasteryBadge.jsx`)
Replace the progress bar toward next level with the full-width `ThetaBar`. The requirements checklist (responses, accuracy thresholds) moves below the bar as supporting detail. The stale banner appears above the bar when `isStale` is true.

### `MasterySummary` (in `MasteryBadge.jsx`)
No structural change. Replace the level-colored progress bars with the level colors defined by `ThetaBar` to keep the palette consistent.

---

## Page Changes

### 1. Student Dashboard (`DashboardPage.jsx`)
- **Weak skills section** (currently: red/amber/green progress bar + "73% mastery" text)
  → Replace with compact `ThetaBar` per skill card
- **Strong skills section** (currently: "73% mastery" text)
  → Replace with compact `ThetaBar`

Data available via `progressService.getSkills()` → `/api/v1/progress/skills`. `theta` is already included in the response (populated at `progress.py:289`). No data source change needed.

### 2. Progress Page (`ProgressPage.jsx`)
- Uses `SkillMasteryRow` and `MasteryBadge` — both updated above, no additional page changes needed
- `MasterySummary` updated palette for consistency

### 3. Adaptive Practice Results (`AdaptivePracticePage.jsx`)
- Current: `Badge` component with "73% mastery" (legacy percentage)
  → Replace with compact `ThetaBar` per updated skill
- Add **level-change delta indicator**: if `mastery_level_enum` increased this session (e.g., Familiar → Proficient), show a small `↑ Proficient` badge in the level's color next to the bar

### 4. Tutor Student Detail (`StudentDetailPage.jsx`)
- `SkillMasteryRow` updated (see above)
- Pass `showSE={true}` and `se={skill.ability_se}` to `ThetaBar`
- Remove the existing raw theta text fallback (lines 154–160) — the bar handles this now
- The "needs review" filter toggle stays as-is

---

## Data Availability

All required fields are already returned by the `/api/v1/adaptive/mastery-profile` endpoint:

| Field | Source | Notes |
|-------|--------|-------|
| `theta` | `SkillMasteryInfo.theta` | Optional[float], null if no data |
| `mastery_level` | `SkillMasteryInfo.mastery_level` | 0–3 enum |
| `ability_se` | Not in `SkillMasteryInfo` schema | **Must be added** to `SkillMasteryInfo` schema and populated in both `progress.py` (`_build_skill_mastery_info`) and `adaptive.py` (`_build_skill_mastery_info`) |
| `is_stale` | `SkillMasteryInfo.is_stale` | Already present |
| `responses_count` | `SkillMasteryInfo.responses_count` | Already present |

**Backend change required:** Add `ability_se: Optional[float]` to `SkillMasteryInfo` in `backend/app/schemas/adaptive.py` and populate it from `student_skill.ability_se` in `_build_skill_mastery_info()` in `backend/app/api/v1/adaptive.py`.

---

## Critical Files

| File | Change |
|------|--------|
| `frontend/src/components/ui/ThetaBar.jsx` | **New component** |
| `frontend/src/components/ui/MasteryBadge.jsx` | Update `SkillMasteryRow`, `MasteryProgressCard`, `MasterySummary` |
| `frontend/src/pages/student/DashboardPage.jsx` | Replace legacy % bars with ThetaBar |
| `frontend/src/pages/shared/ProgressPage.jsx` | Minor: picks up changes via updated components |
| `frontend/src/pages/student/AdaptivePracticePage.jsx` | Replace Badge % with ThetaBar + delta indicator |
| `frontend/src/pages/tutor/StudentDetailPage.jsx` | Pass `showSE` + `se` props; remove raw theta fallback |
| `backend/app/schemas/adaptive.py` | Add `ability_se: Optional[float]` to `SkillMasteryInfo` |
| `backend/app/api/v1/adaptive.py` | Populate `ability_se` in `_build_skill_mastery_info()` |
| `backend/app/api/v1/progress.py` | Populate `ability_se` in the skill builder (line ~289) |

---

## Verification

1. **ThetaBar renders correctly across all theta values**: θ = −2.5 (Familiar), θ = 0.3 (Proficient), θ = 1.8 (Mastered), θ = null (Not Started)
2. **Marker/label divergence**: Manually set a student with θ = 0.5 but mastery_level_enum = 1 (Familiar) — confirm bar shows marker in green zone with "Familiar" label
3. **Stale state**: Student with no practice in 15+ days shows orange bar on all four pages
4. **Tutor view**: ± SE shows on StudentDetailPage, hidden on all student pages
5. **Level-change delta**: Complete an adaptive session that causes a level-up — confirm `↑ Proficient` delta badge appears
6. **Dark mode**: All ThetaBar variants render correctly in dark mode
7. **Not Started**: Skill with zero responses shows gray dashed bar, no marker, "Not Started" label
