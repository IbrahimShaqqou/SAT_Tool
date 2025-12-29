# Adaptive Learning System - Implementation Plan

## Overview

This document outlines the design and implementation plan for an IRT-based adaptive learning system that:
- Tracks student ability (theta) per skill and domain
- Selects questions for maximum information gain
- Avoids question repetition with configurable windows
- Provides intake assessments for initial placement
- Adapts aggressiveness based on session length

---

## 1. Question Selection & Repetition

### 1.1 Cross-Session Memory

**Decision**: Track all questions a student has seen across all sessions.

**Implementation**:
- Store `last_seen_at` timestamp on `StudentResponse` records
- Query excludes questions seen within the repetition window
- If pool exhausted within window, expand window gradually

**Database Changes**:
```sql
-- StudentResponse already has created_at, use that as last_seen
-- Add index for efficient querying
CREATE INDEX idx_student_response_question_student
ON student_responses(student_id, question_id, created_at DESC);
```

### 1.2 Repetition Window

**Default Settings**:
| Setting | Default | Min | Max |
|---------|---------|-----|-----|
| Time-based window | 14 days | 1 day | 90 days |
| Question-based window | 50 questions | 10 | 200 |

**Logic**: A question is available if BOTH conditions are met:
- Last seen > X days ago, AND
- Student has answered >= Y other questions since

**Tutor Configuration**:
```
Settings > Student Settings > Repetition Window
├── Time window: [slider: 1-90 days, default 14]
├── Question window: [slider: 10-200, default 50]
└── Apply to: [All students / Selected students]
```

**Implementation**:
```python
def get_available_questions(student_id, skill_ids, db):
    """Get questions not seen within repetition window."""
    settings = get_student_settings(student_id)
    time_window = settings.repetition_time_days  # default 14
    question_window = settings.repetition_question_count  # default 50

    cutoff_date = datetime.now() - timedelta(days=time_window)

    # Get recently seen question IDs
    recent_responses = db.query(StudentResponse)\
        .filter(StudentResponse.student_id == student_id)\
        .order_by(StudentResponse.created_at.desc())\
        .limit(question_window)\
        .all()

    recent_question_ids = {r.question_id for r in recent_responses}
    time_blocked_ids = {r.question_id for r in recent_responses
                        if r.created_at > cutoff_date}

    # Question available if not in BOTH blocked sets
    blocked_ids = recent_question_ids & time_blocked_ids

    return db.query(Question)\
        .filter(Question.skill_id.in_(skill_ids))\
        .filter(~Question.id.in_(blocked_ids))\
        .all()
```

---

## 2. Ability Tracking (Theta)

### 2.1 Hierarchical Theta Structure

```
SAT Score (composite)
├── Math Section Theta
│   ├── Algebra Domain Theta
│   │   ├── Linear Equations Skill Theta
│   │   ├── Linear Inequalities Skill Theta
│   │   └── ...
│   ├── Advanced Math Domain Theta
│   │   └── ...
│   ├── Problem Solving Domain Theta
│   │   └── ...
│   └── Geometry Domain Theta
│       └── ...
└── Reading & Writing Section Theta
    ├── Information and Ideas Domain Theta
    │   └── ...
    ├── Craft and Structure Domain Theta
    │   └── ...
    ├── Expression of Ideas Domain Theta
    │   └── ...
    └── Standard English Conventions Domain Theta
        └── ...
```

### 2.2 Database Schema Updates

```sql
-- Add domain-level ability tracking
CREATE TABLE student_domain_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    domain_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
    ability_theta FLOAT DEFAULT 0.0,
    ability_se FLOAT DEFAULT 1.0,  -- Standard error
    responses_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, domain_id)
);

-- Add section-level ability tracking
CREATE TABLE student_section_abilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    section VARCHAR(20) NOT NULL,  -- 'math' or 'reading_writing'
    ability_theta FLOAT DEFAULT 0.0,
    ability_se FLOAT DEFAULT 1.0,
    responses_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, section)
);

-- Add tutor-configurable student settings
CREATE TABLE student_adaptive_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    repetition_time_days INTEGER DEFAULT 14,
    repetition_question_count INTEGER DEFAULT 50,
    challenge_bias FLOAT DEFAULT 0.3,  -- 0.0 to 1.0
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Theta Update Propagation

When a student answers a question:

```python
def update_all_abilities(student_id, question, is_correct, db):
    """Update skill, domain, and section abilities."""

    # 1. Update skill theta (most granular)
    skill_theta, skill_se = update_skill_ability(
        student_id, question.skill_id, is_correct, db
    )

    # 2. Update domain theta (aggregate of skills)
    domain_theta = update_domain_ability(
        student_id, question.skill.domain_id, db
    )

    # 3. Update section theta (aggregate of domains)
    section = 'math' if question.skill.domain.section == 'Math' else 'reading_writing'
    section_theta = update_section_ability(student_id, section, db)

    return {
        'skill_theta': skill_theta,
        'domain_theta': domain_theta,
        'section_theta': section_theta
    }

def update_domain_ability(student_id, domain_id, db):
    """Aggregate skill thetas to domain level."""
    skill_abilities = db.query(StudentSkill)\
        .join(Skill)\
        .filter(StudentSkill.student_id == student_id)\
        .filter(Skill.domain_id == domain_id)\
        .filter(StudentSkill.responses_for_estimate >= 3)\  # Min responses
        .all()

    if not skill_abilities:
        return 0.0

    # Weighted average by inverse variance (precision-weighted)
    total_weight = 0
    weighted_sum = 0
    for sa in skill_abilities:
        weight = 1 / (sa.ability_se ** 2) if sa.ability_se > 0 else 1
        weighted_sum += sa.ability_theta * weight
        total_weight += weight

    domain_theta = weighted_sum / total_weight if total_weight > 0 else 0

    # Update domain record
    domain_ability = get_or_create_domain_ability(student_id, domain_id, db)
    domain_ability.ability_theta = domain_theta
    domain_ability.last_updated = datetime.now()
    db.commit()

    return domain_theta
```

---

## 3. Intake Assessment System

### 3.1 Assessment Hierarchy Options

| Level | Questions | Duration | When to Use |
|-------|-----------|----------|-------------|
| **Full SAT Diagnostic** | 40-50 | 60-90 min | New students, comprehensive baseline |
| **Section Assessment** | 20-25 | 30-40 min | Focus on Math OR Reading/Writing |
| **Domain Assessment** | 8-12 | 15-20 min | Target specific weakness |
| **Skill Quick-Check** | 3-5 | 5 min | Verify single skill level |

### 3.2 Full SAT Diagnostic Assessment

**Purpose**: Establish baseline theta for all domains and predict SAT score range.

**Structure**:
```
Full Diagnostic (44 questions, ~75 minutes)
├── Math Section (22 questions)
│   ├── Algebra (6 questions: 2 easy, 2 medium, 2 hard)
│   ├── Advanced Math (6 questions: 2 easy, 2 medium, 2 hard)
│   ├── Problem Solving (5 questions: 1 easy, 2 medium, 2 hard)
│   └── Geometry (5 questions: 1 easy, 2 medium, 2 hard)
└── Reading & Writing Section (22 questions)
    ├── Information and Ideas (6 questions)
    ├── Craft and Structure (6 questions)
    ├── Expression of Ideas (5 questions)
    └── Standard English Conventions (5 questions)
```

**Adaptive Within Assessment**:
- Start each domain with medium difficulty
- Branch up/down based on performance
- Use CAT (Computerized Adaptive Testing) methodology

**Algorithm**:
```python
def select_diagnostic_question(student_id, domain_id, answered_in_domain, db):
    """Select next diagnostic question using CAT methodology."""

    if len(answered_in_domain) == 0:
        # First question: medium difficulty (b ≈ 0)
        target_b = 0.0
    else:
        # Estimate current theta from domain responses
        current_theta = estimate_theta_from_responses(answered_in_domain)
        # Target slightly above current estimate
        target_b = current_theta + 0.3

    # Get questions not yet asked
    available = get_domain_questions(domain_id, exclude=answered_in_domain)

    # Select question closest to target difficulty
    return min(available, key=lambda q: abs(q.irt_difficulty_b - target_b))
```

### 3.3 Section Assessment

**When**: Student wants to focus on Math or Reading/Writing only.

**Structure**: 20-25 questions across all domains in that section, adaptive.

### 3.4 Domain Assessment

**When**: Tutor identifies a weak domain, wants detailed skill breakdown.

**Structure**:
- 2-3 questions per skill in domain
- Results show skill-level strengths/weaknesses
- ~10-15 minutes

### 3.5 Skill Quick-Check

**When**: Before practice session, verify current level.

**Structure**:
- 3-5 questions targeting current theta estimate
- Refines theta before practice begins
- Optional, can be skipped

### 3.6 Assessment Results & Recommendations

```python
def generate_assessment_report(student_id, assessment_id, db):
    """Generate detailed report from diagnostic assessment."""

    results = get_assessment_results(assessment_id)

    report = {
        'predicted_sat_range': calculate_sat_range(results),
        'section_scores': {
            'math': estimate_section_score(results, 'math'),
            'reading_writing': estimate_section_score(results, 'reading_writing')
        },
        'domain_breakdown': [],
        'priority_skills': [],
        'recommended_plan': []
    }

    # Rank domains by weakness
    for domain in results.domains:
        report['domain_breakdown'].append({
            'name': domain.name,
            'theta': domain.theta,
            'percentile': theta_to_percentile(domain.theta),
            'skills': domain.skill_breakdown
        })

    # Identify priority skills (low theta, high question count on SAT)
    weak_skills = sorted(
        results.skills,
        key=lambda s: s.theta + (s.sat_weight * 0.5)  # Balance weakness and importance
    )[:5]
    report['priority_skills'] = weak_skills

    # Generate study plan
    report['recommended_plan'] = generate_study_plan(weak_skills)

    return report
```

---

## 4. Question Selection Algorithm

### 4.1 Maximum Information with Progressive Challenge

```python
def select_adaptive_question(
    student_id: str,
    skill_ids: List[int],
    session_questions_answered: int,
    session_total_questions: int,
    db
) -> Question:
    """
    Select question maximizing information gain with progressive challenge.
    """

    # Get student settings
    settings = get_student_settings(student_id)
    challenge_bias = settings.challenge_bias  # default 0.3

    # Get current theta for primary skill
    primary_skill_id = skill_ids[0]  # Or use weighted selection
    theta, se = get_skill_ability(student_id, primary_skill_id, db)

    # Get available questions (respecting repetition window)
    available = get_available_questions(student_id, skill_ids, db)

    if not available:
        return None  # Or expand window

    # Calculate session progress (0.0 to 1.0)
    progress = session_questions_answered / session_total_questions

    # Progressive challenge: increase target difficulty as session progresses
    # Early: target at theta, Late: target above theta
    progressive_offset = challenge_bias * progress * 0.5  # Max +0.15 by end
    target_theta = theta + progressive_offset

    # Calculate information for each question
    candidates = []
    for q in available:
        a = q.irt_discrimination_a or 1.0
        b = q.irt_difficulty_b or 0.0
        c = q.irt_guessing_c or 0.25

        # Fisher information at student's theta
        info = item_information(theta, a, b, c)

        # Bonus for questions slightly above current ability
        if b > theta:
            difficulty_bonus = min(0.5, (b - theta) * challenge_bias)
            info *= (1 + difficulty_bonus)

        # Penalty for questions too far from target
        distance_penalty = abs(b - target_theta) * 0.1
        info *= (1 - distance_penalty)

        candidates.append((q, info, b))

    # Sort by information score
    candidates.sort(key=lambda x: x[1], reverse=True)

    # Add diversity: don't always pick the absolute best
    # Take top 5, ensure difficulty variety, then random from top 3
    top_candidates = candidates[:5]

    # Ensure we have different difficulties in consideration
    diverse_candidates = ensure_difficulty_diversity(top_candidates)

    # Random selection from top diverse candidates
    selected = random.choice(diverse_candidates[:3])

    return selected[0]

def ensure_difficulty_diversity(candidates):
    """Ensure candidates span different difficulty levels."""
    seen_bands = set()
    diverse = []

    for q, info, b in candidates:
        band = round(b * 2) / 2  # Round to 0.5 increments
        if band not in seen_bands or len(diverse) < 3:
            diverse.append((q, info, b))
            seen_bands.add(band)

    return diverse
```

### 4.2 Session Length Aggressiveness

```python
def get_theta_update_weight(session_length: int) -> float:
    """
    Shorter sessions = more aggressive updates.
    Longer sessions = smoother updates.
    """
    if session_length <= 5:
        return 1.5  # Very aggressive
    elif session_length <= 10:
        return 1.2  # Aggressive
    elif session_length <= 20:
        return 1.0  # Normal
    else:
        return 0.8  # Conservative

def estimate_ability_weighted(responses, session_length):
    """EAP estimation with session-length weighting."""

    weight = get_theta_update_weight(session_length)

    # Standard EAP calculation
    theta, se = calculate_eap(responses)

    # Apply weight to change from prior
    prior_theta = responses[0].ability_estimate_before if responses else 0
    theta_change = theta - prior_theta
    weighted_theta = prior_theta + (theta_change * weight)

    # Adjust SE based on weight
    weighted_se = se / weight  # More aggressive = lower reported SE

    return weighted_theta, weighted_se
```

---

## 5. Low Question Pool Warnings

### 5.1 Warning Thresholds

| Situation | Threshold | Action |
|-----------|-----------|--------|
| Skill pool low | < 10 available | Yellow warning to tutor |
| Skill pool critical | < 5 available | Red warning, suggest alternatives |
| Skill pool exhausted | 0 available | Auto-expand window or switch skill |

### 5.2 Implementation

```python
def check_question_pool_health(student_id, skill_ids, db):
    """Check if question pools are healthy for selected skills."""

    warnings = []

    for skill_id in skill_ids:
        available = get_available_questions(student_id, [skill_id], db)
        total = get_total_questions_for_skill(skill_id, db)

        if len(available) == 0:
            warnings.append({
                'skill_id': skill_id,
                'level': 'critical',
                'message': f'No questions available. Student has seen all {total} questions within repetition window.',
                'suggestion': 'Expand repetition window or add more questions to this skill.'
            })
        elif len(available) < 5:
            warnings.append({
                'skill_id': skill_id,
                'level': 'warning',
                'message': f'Only {len(available)} questions available out of {total}.',
                'suggestion': 'Consider expanding repetition window.'
            })
        elif len(available) < 10:
            warnings.append({
                'skill_id': skill_id,
                'level': 'info',
                'message': f'{len(available)} questions available out of {total}.',
                'suggestion': None
            })

    return warnings
```

### 5.3 Tutor Dashboard Integration

```
Student Practice Overview
├── John Doe
│   ├── Linear Equations: 45 available ✓
│   ├── Quadratic Functions: 8 available ⚠️ (low)
│   └── Systems of Equations: 2 available 🔴 (critical)
```

---

## 6. Theta Decay System

### 6.1 Decay Logic

**Purpose**: Re-emphasize skills that haven't been practiced recently. Theta decays toward 0 (neutral) over time.

**Parameters**:
| Parameter | Value | Notes |
|-----------|-------|-------|
| Grace period | 14 days | No decay within 14 days of last practice |
| Decay rate | -0.05/week | After grace period |
| Minimum theta | -2.0 | Floor (won't decay below this) |
| Decay target | 0.0 | Decay toward neutral, not negative |

**Formula**:
```python
def calculate_decayed_theta(skill_record):
    """Calculate theta with decay applied."""
    days_since_practice = (now() - skill_record.last_practiced).days

    if days_since_practice <= 14:
        return skill_record.ability_theta  # No decay in grace period

    # Weeks past grace period
    weeks_inactive = (days_since_practice - 14) / 7

    # Decay toward 0, not into negative
    current_theta = skill_record.ability_theta

    if current_theta > 0:
        # Positive theta decays toward 0
        decay = min(current_theta, 0.05 * weeks_inactive)
        return current_theta - decay
    elif current_theta < 0:
        # Negative theta recovers toward 0 (student improves with rest)
        recovery = min(abs(current_theta), 0.025 * weeks_inactive)
        return current_theta + recovery
    else:
        return 0.0
```

### 6.2 When to Apply Decay

1. **On Read**: When fetching theta for question selection or display
2. **Not Persisted**: Decay is calculated on-the-fly, not stored
3. **Reset on Practice**: Any practice resets the "last practiced" timestamp

### 6.3 Stale Skill Detection

```python
def get_stale_skills(student_id, db):
    """Get skills that are becoming stale and need review."""

    skills = db.query(StudentSkill)\
        .filter(StudentSkill.student_id == student_id)\
        .filter(StudentSkill.ability_theta > 0.5)\  # Only warn for mastered skills
        .all()

    stale = []
    for skill in skills:
        days_inactive = (now() - skill.last_practiced).days

        if days_inactive >= 21:  # 3+ weeks
            stale.append({
                'skill': skill,
                'days_inactive': days_inactive,
                'original_theta': skill.ability_theta,
                'decayed_theta': calculate_decayed_theta(skill),
                'urgency': 'high' if days_inactive >= 30 else 'medium'
            })

    return sorted(stale, key=lambda x: x['days_inactive'], reverse=True)
```

### 6.4 Tutor Stale Skills View

```
⚠️ Skills Needing Review - John Doe

| Skill | Last Practiced | Original | Current | Action |
|-------|----------------|----------|---------|--------|
| Quadratics | 35 days ago | θ=1.2 | θ=0.95 | [Assign Practice] |
| Linear Ineq | 28 days ago | θ=0.8 | θ=0.65 | [Assign Practice] |
```

---

## 7. API Endpoints

### 6.1 New Endpoints Needed

```python
# Intake Assessments
POST   /api/v1/assessments/diagnostic          # Start full diagnostic
POST   /api/v1/assessments/section/{section}   # Start section assessment
POST   /api/v1/assessments/domain/{domain_id}  # Start domain assessment
POST   /api/v1/assessments/{id}/answer         # Submit answer
GET    /api/v1/assessments/{id}/results        # Get results/report

# Student Settings (Tutor access)
GET    /api/v1/students/{id}/adaptive-settings
PUT    /api/v1/students/{id}/adaptive-settings

# Question Pool Health
GET    /api/v1/students/{id}/question-pool-health?skill_ids=1,2,3

# Ability Overview
GET    /api/v1/students/{id}/abilities         # All thetas (skill, domain, section)
GET    /api/v1/students/{id}/abilities/history # Theta over time
```

---

## 7. Implementation Phases

### Phase 1: Core Improvements (COMPLETED - Dec 28, 2024)
- [x] Fix question repetition (cross-session memory)
- [x] Add repetition window settings table (`student_adaptive_settings`)
- [x] Implement progressive challenge bias
- [x] Add session-length aggressiveness
- [x] Add question pool warnings
- [x] "Test the water" exploration mode (15% chance to try harder questions)
- [x] Sliding window estimation (last 20 responses only for responsiveness)
- [x] Session accuracy floor (theta >= 0.5 if 80%+ accuracy)

**Implementation Details:**
- Created `StudentAdaptiveSettings` model with generous defaults (7 days, 30 questions)
- Created `StudentDomainAbility` and `StudentSectionAbility` models for hierarchical tracking
- Updated `select_adaptive_question` to accept `session_progress` for progressive challenge
- Added `select_adaptive_question_with_memory` for cross-session question exclusion
- Added `get_session_aggressiveness_weight` function (1.5x for 5Q, 1.2x for 10Q, 1.0x for 20Q)
- Updated `update_skill_ability` to use session length for theta update weighting
- Pool health warnings returned with question selection (critical/warning/info levels)
- Added `EXPLORATION_PROBABILITY = 0.15` for "test the water" hard questions
- Added `ABILITY_ESTIMATION_WINDOW = 20` for sliding window estimation
- Added `MIN_THETA_FOR_HIGH_ACCURACY = 0.5` for session accuracy floor

### Phase 2: Hierarchical Theta (COMPLETED - Dec 28, 2024)
- [x] Add domain_abilities table
- [x] Add section_abilities table
- [x] Implement theta propagation (skill → domain → section)
- [x] Theta decay calculation (14-day grace period, -0.05/week)
- [x] Stale skills detection (3+ weeks inactive)
- [x] API endpoints for hierarchical profile and stale skills
- [ ] Update tutor dashboard with domain/section views (frontend pending)

**Implementation Details:**
- Created Alembic migration `20251228_add_adaptive_learning_tables.py`
- Added `update_domain_ability()` - aggregates skill thetas weighted by response count
- Added `update_section_ability()` - aggregates domain thetas, calculates predicted SAT scores
- Added `propagate_ability_updates()` - cascades skill updates to domain and section
- Added `calculate_decayed_theta()` - applies decay after 14-day grace period
- Added `get_stale_skills()` - identifies skills inactive 3+ weeks
- New API endpoints: `/adaptive/students/{id}/stale-skills`, `/adaptive/students/{id}/hierarchical-profile`
- Predicted SAT score ranges calculated from section theta (200-800 scale)

### Phase 3: Intake Assessments (COMPLETED - Dec 28, 2024)
- [x] Design assessment question selection algorithm (CAT-style)
- [x] Create diagnostic assessment flow
- [x] Create section/domain assessment flows
- [x] Build assessment results/report API
- [x] Generate study plan recommendations

**Implementation Details:**
- Created `intake_service.py` with CAT question selection
- Added `AssessmentType` enum: intake, section, domain, quick_check
- Invite links now default to intake assessment (40 questions)
- Stratified sampling across all domains with difficulty spread
- New API endpoint `/assess/{token}/results` returns detailed breakdown
- Results include: per-domain theta, predicted SAT scores, priority areas
- Updated InvitesPage to default to intake assessment UI

### Phase 4: Tutor Controls
- [ ] Build student adaptive settings UI
- [ ] Add repetition window configuration
- [ ] Add challenge bias slider
- [ ] Question pool health dashboard
- [ ] Bulk settings for multiple students

### Phase 5: Analytics & Refinement
- [ ] Track theta accuracy over time
- [ ] A/B test different challenge biases
- [ ] Refine information gain calculations
- [ ] Add predicted score tracking

---

## 8. Finalized Decisions

1. **Intake Assessment Timing**: Tutor-assigned. UI should clearly indicate importance of diagnostic for accurate placement. Tutors assign via student management.

2. **Theta Decay**: YES - Implement decay for inactive skills to re-emphasize topics not studied recently.
   - Decay rate: -0.05 theta per week of inactivity (capped at returning to 0)
   - Decay starts after 14 days of no practice on that skill
   - Tutor dashboard shows "stale" skills that need review

3. **Confidence Intervals**: Show SE to tutors only (not students). Helps tutors understand estimate reliability.

4. **Cross-Skill Transfer**: NO - Do not transfer theta between related skills. Rely on diagnostic assessment to establish proper baselines for all skills.

5. **Minimum Practice**: Require 5 questions before showing mastery percentage. Before that, show "Gathering data..." or similar.

### Open Questions (Lower Priority)

- Should theta decay be configurable by tutor?
- Should we notify students when skills are becoming "stale"?

---

## 9. Technical Notes

### IRT Formulas Reference

**3PL Probability**:
```
P(θ) = c + (1-c) / (1 + e^(-a(θ-b)))
```

**Fisher Information**:
```
I(θ) = a² × P × Q × ((P-c)/(1-c))²
where Q = 1-P
```

**EAP Estimation**:
```
θ̂ = ∫θ × L(θ) × π(θ) dθ / ∫L(θ) × π(θ) dθ
where L(θ) = likelihood, π(θ) = prior
```

### Performance Considerations

- Index `student_responses` on `(student_id, question_id, created_at)`
- Cache skill thetas in Redis for fast lookup
- Batch theta updates for multiple skills
- Pre-compute question information at common theta values

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Status: Planning*
