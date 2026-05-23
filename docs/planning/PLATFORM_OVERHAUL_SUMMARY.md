# SAT Tool Platform Overhaul - Pre-Client Launch Plan

## Business Model
**Money-Back Guarantee Tutoring** (inspired by Princeton Review)
- "Improve 100+ points or get your money back"
- Requirements: Complete diagnostic, follow study plan (80%+ completion), take all practice tests (minimum 3), answer 500+ questions, review mistakes
- Target: Facebook/local client acquisition with compelling guarantee

## Current Status (What We Have)
✅ **Excellent Foundation**:
- 3,346 College Board questions (1,756 math + 1,590 reading/writing)
- IRT-based adaptive practice system
- Diagnostic assessments (15 questions per section)
- 29 skills with mastery tracking (Not Started → Familiar → Proficient → Mastered)
- Tutor dashboard with detailed analytics
- Practice Test 4 fully mapped (147 unique questions: easy + hard Module 2 variants)

## Critical Gaps (What's Missing for Guarantee Model)

### 1. ❌ Full-Length SAT Practice Tests
**Problem**: No realistic 98-question, 2+ hour test simulation
**Impact**: Can't validate students are improving on actual test conditions
**Need**: 
- 4 timed modules (2 Math, 2 Reading/Writing)
- Bluebook-faithful UI (matches official SAT)
- 2-stage adaptive (Module 2 adapts based on Module 1 performance)
- Score prediction (400-1600 scale)
- Progress tracking across multiple practice tests

### 2. ❌ Comprehensive Study Plan Generator
**Problem**: Just ad-hoc "practice this skill" recommendations
**Impact**: Students don't know WHAT to do or WHEN to do it
**Need**:
- 8-12 week structured plans
- Weekly goals and milestones
- Activity scheduling (Mon/Wed/Fri: practice, Sat: practice test)
- Progress tracking (% completion, on-pace warnings)
- Auto-adjustment based on performance

### 3. ❌ Test-Taking Strategy System
**Problem**: Only provides questions, no instruction on HOW to approach them
**Impact**: Smart students struggle because they don't know SAT-specific tactics
**Need**:
- Strategy tips library (process of elimination, time management, etc.)
- Inline tips during practice
- Pre-test strategy briefings
- Post-mistake strategy suggestions

### 4. ❌ Mistake Review & Spaced Repetition
**Problem**: Students answer questions but don't systematically review errors
**Impact**: Same mistakes repeated, no real learning
**Need**:
- Flagged questions library
- Spaced repetition scheduling (review after 1, 3, 7, 14 days)
- Error pattern analysis ("you always miss quadratic equations")
- Daily review prompts

### 5. ❌ Session Planning System (for 1-on-1 tutoring)
**Problem**: You (tutor) manually plan what to cover with each student
**Impact**: Inefficient prep, no continuity between sessions
**Need**:
- Auto-generated session plans based on student weaknesses
- Curated question sets for in-session practice
- Session notes and progress tracking
- Homework assignment tool

### 6. ❌ Progress Visualization & Motivation
**Problem**: Students see numbers but don't feel progress emotionally
**Impact**: Motivation drops, students quit before hitting goals
**Need**:
- Visual charts (score trajectory, skill mastery pie chart)
- Gamification (streaks, achievements, badges)
- Projected score ("At current pace, estimated: 1280")

### 7. ❌ Tutor Intervention System
**Problem**: Can't manually check every student daily
**Impact**: At-risk students slip through cracks
**Need**:
- Automatic alerts (hasn't practiced in 3+ days, falling behind plan, accuracy dropping)
- Tutor dashboard with flagged students
- Quick assign feature (send targeted homework)

---

## Implementation Priority

### **PHASE 1: CORE GUARANTEE REQUIREMENTS** (Must-Have Before Clients)
**Timeline**: 4-6 weeks

#### 1.1 Full-Length Practice Tests (Week 1-2) ⭐⭐⭐ CRITICAL
**Why First**: Without this, you can't prove students are improving on real test conditions

**Backend**:
- [ ] Update `test.py` model with `FULL_LENGTH_SAT` type
- [ ] Create `test_generation_service.py` to generate 98-question tests
  - Use Practice Test 4 mappings for official tests
  - Generate adaptive tests from question bank
- [ ] Add `practice_test_mappings` table to store test metadata
- [ ] Create API endpoints:
  - `POST /api/practice/full-length` - Start test (official or adaptive)
  - `GET /api/practice/full-length/{test_id}` - Resume test
  - `POST /api/practice/full-length/{test_id}/module/{module_num}/submit` - Submit module
  - `GET /api/practice/full-length/{test_id}/results` - Get detailed results
- [ ] Implement 2-stage adaptive logic (easier/harder Module 2 based on Module 1)
- [ ] Add SAT scoring algorithm (raw score → 200-800 per section)

**Frontend**:
- [ ] `/student/practice-tests` - List of available tests (Practice Test 4, adaptive)
- [ ] `/student/full-length-test/{test_id}` - Test taking interface
  - Module selection screen
  - Timed question interface (matches Bluebook design)
  - 5-minute break screens
  - Timer with warnings
- [ ] `/student/full-length-results/{test_id}` - Detailed score report
  - Overall score (400-1600)
  - Section scores (Math 200-800, R/W 200-800)
  - Per-skill breakdown
  - Time management analysis
  - Comparison to previous tests

**Success Criteria**:
- Students can take Practice Test 4 (both easy and hard Module 2 variants)
- Students can take adaptive full-length tests
- Results show SAT-scaled scores (400-1600)
- Score predictions validate against real SAT scores

---

#### 1.2 Study Plan Generator (Week 3-4) ⭐⭐⭐ CRITICAL
**Why**: Students need to know WHAT work is required for the guarantee

**Backend**:
- [ ] Create `study_plan.py`, `study_plan_week.py`, `study_plan_activity.py` models
- [ ] Create `study_plan_service.py`:
  - `generate_study_plan(student_id, target_score, test_date, hours_per_week)`
  - Analyze current skill levels
  - Prioritize weak areas (frequency × gap)
  - Distribute across weeks
  - Schedule activities (practice, tests, review)
- [ ] Add adaptive adjustment (recalculate weekly based on progress)
- [ ] API endpoints:
  - `POST /api/study-plans/generate`
  - `GET /api/study-plans/{plan_id}`
  - `GET /api/study-plans/{plan_id}/week/{week_num}`
  - `PATCH /api/study-plans/{plan_id}/activities/{activity_id}` - Mark complete

**Frontend**:
- [ ] `/student/study-plan` - Enhanced study plan page
  - Overview ("Week 3 of 10 | 65% on track | Target: 1300")
  - This week's activities with checkboxes
  - Calendar view
  - Progress bar (questions answered / target)
  - Milestones
- [ ] `/tutor/student-study-plan/{student_id}` - Tutor customization
  - View auto-generated plan
  - Override activities
  - Adjust hours per week
  - Add custom notes

**Success Criteria**:
- Students see 8-12 week plan with specific weekly goals
- Plan updates based on actual progress
- Tutor can customize plans
- Tracks compliance (for guarantee eligibility)

---

#### 1.3 Mistake Review & Spaced Repetition (Week 5-6) ⭐⭐ HIGH PRIORITY
**Why**: Ensures students actually learn from errors (not just grind questions)

**Backend**:
- [ ] Update `student_response.py` model:
  - Add `reviewed: bool`
  - Add `flagged_for_review: bool`
  - Add `retry_scheduled_at: timestamp`
  - Add `retry_count: int`
- [ ] Create `spaced_repetition_service.py`:
  - Schedule retries (1, 3, 7, 14 days)
  - Adjust schedule based on correctness
- [ ] API endpoints:
  - `GET /api/students/mistakes/recent` - Last 7 days
  - `GET /api/students/mistakes/flagged` - Manually marked
  - `GET /api/students/mistakes/due-for-retry` - Scheduled by spaced repetition
  - `GET /api/students/mistakes/error-patterns` - Skill-level analysis

**Frontend**:
- [ ] `/student/mistake-review` - New page with tabs:
  - Recent Mistakes (last 7 days)
  - Flagged Questions
  - Due for Retry
  - Error Patterns
- [ ] Daily review prompt banner
- [ ] "Review accuracy improves over time" chart

**Success Criteria**:
- Students automatically scheduled to retry wrong questions
- Daily "8 questions due for review" notifications
- Error pattern analysis shows "you consistently miss skill X"

---

### **PHASE 2: ENHANCED TEACHING** (Pre-Scale Improvements)
**Timeline**: 4-6 weeks after Phase 1

#### 2.1 Test-Taking Strategy System (Week 7-8) ⭐⭐ HIGH PRIORITY
- [ ] Create `strategy_tip.py` model
- [ ] Strategy library page (browse tips by skill/domain)
- [ ] Inline tips (show after 2+ wrong attempts on question type)
- [ ] Pre-test strategy briefing (before full-length tests)
- [ ] "Top 5 SAT Strategies" quick reference

#### 2.2 Progress Visualization & Gamification (Week 9-10) ⭐ MEDIUM PRIORITY
- [ ] Score trajectory chart (diagnostic → practice tests → projected)
- [ ] Skill mastery pie chart
- [ ] Questions per week bar chart
- [ ] Achievements system (100 questions, 10 skills mastered, 7-day streak)
- [ ] Streak counter (days in a row)

#### 2.3 Session Planning System (Week 11-12) ⭐ MEDIUM PRIORITY
- [ ] Create `session_plan.py`, `tutoring_session.py` models
- [ ] Auto-generate session plans based on student weaknesses
- [ ] Curated question sets for in-session practice
- [ ] Session notes and homework assignment
- [ ] `/tutor/session-planning` dashboard

---

### **PHASE 3: TUTOR OPERATIONS** (Multi-Student Scale)
**Timeline**: 2-3 weeks after Phase 2

#### 3.1 Tutor Intervention System (Week 13-14) ⭐ HIGH PRIORITY for scale
- [ ] Alert system (student hasn't practiced in 3+ days, falling behind, accuracy dropping)
- [ ] `/tutor/alerts` - Flagged students dashboard
- [ ] Quick assign feature (assign 20 questions to student)
- [ ] In-platform messaging (optional, can use email for now)

---

## Complete Practice Test Extraction Plan

**Current**: Practice Test 4 complete (easy + hard Module 2)
**Remaining**: Practice Tests 1, 2, 3, 5, 6

**Process per test**:
1. Take test scoring low on Module 1 → extract Module 2 easy
2. Take test scoring high on Module 1 → extract Module 2 hard
3. Run matching script (96%+ automatic)
4. Manually match 2-4 remaining questions
5. Backup and archive

**Timeline**: ~2-3 hours per test × 5 tests = 10-15 hours total
**Can parallelize**: Do during Phase 1 implementation

---

## Success Metrics for Guarantee Model

### Student Compliance (For Eligibility)
- [ ] Diagnostic completed
- [ ] Study plan 80%+ completion
- [ ] Minimum 3 full-length practice tests taken
- [ ] 500+ total questions answered
- [ ] All flagged mistakes reviewed

### Score Improvement Validation
- [ ] Diagnostic baseline established
- [ ] Practice test 1 → +30-50 points
- [ ] Practice test 2 → +50-80 points
- [ ] Practice test 3 → +80-100+ points
- [ ] Real SAT → +100+ points (guarantee threshold)

### Platform Analytics
- [ ] Score prediction accuracy (practice tests vs. real SAT)
- [ ] Average improvement per week
- [ ] Dropout rate / engagement metrics
- [ ] Time to 100-point improvement

---

## Tech Stack Notes

**Backend**: FastAPI + PostgreSQL + SQLAlchemy
**Frontend**: React + Vite
**Current DB**: Already has questions, skills, students, responses

**New Tables Needed**:
- `practice_test_mappings` (official test metadata)
- `full_length_tests` (test instances)
- `full_length_responses` (module-by-module tracking)
- `study_plans`, `study_plan_weeks`, `study_plan_activities`
- `strategy_tips`, `student_strategy_progress`
- `achievements`, `student_achievements`, `streaks`
- `session_plans`, `tutoring_sessions`
- `tutor_alerts`

**Estimated Database Size**: +10-15 tables, minimal migration complexity

---

## Pre-Launch Checklist

### Phase 1 Completion (Must-Have)
- [ ] Practice Test 4 available in platform (easy + hard)
- [ ] Adaptive full-length tests working
- [ ] SAT scoring algorithm accurate (validated against real scores)
- [ ] Study plan generator creates 8-12 week plans
- [ ] Study plan tracks compliance (for guarantee)
- [ ] Mistake review with spaced repetition working
- [ ] Students can flag questions for review

### Validation
- [ ] Run 1-2 beta students through full flow (diagnostic → study plan → practice tests)
- [ ] Verify score predictions match expected SAT range
- [ ] Test guarantee eligibility tracking
- [ ] Tutor dashboard shows all necessary data

### Business Setup
- [ ] Guarantee terms finalized (legal review recommended)
- [ ] Pricing determined
- [ ] Facebook ad creative prepared
- [ ] Landing page for guarantee offer
- [ ] Payment processing setup
- [ ] Refund process documented

---

## Estimated Timeline

**Phase 1 (Core Guarantee)**: 4-6 weeks
**Phase 2 (Enhanced Teaching)**: 4-6 weeks
**Phase 3 (Tutor Scale)**: 2-3 weeks

**Total**: ~10-15 weeks to fully production-ready
**Minimum Viable**: ~6 weeks (Phase 1 only) to start taking clients with guarantee

---

## Open Questions

1. **Pricing**: How much per student? (Princeton Review charges $1,000-$2,000 for guaranteed programs)
2. **Session Count**: How many 1-on-1 sessions included?
3. **Guarantee Scope**: 100-point improvement on what baseline? (Diagnostic? First practice test?)
4. **Refund Process**: Full refund immediate? Partial? Pro-rated?
5. **Legal**: Need terms & conditions reviewed? (Highly recommended for money-back guarantees)
6. **Scale Target**: How many students can you handle simultaneously? (Determines Phase 3 priority)

---

## Next Immediate Steps

1. ✅ **DONE**: Map Practice Test 4 (easy + hard) - COMPLETE
2. **NOW**: Implement Phase 1.1 - Full-Length Practice Tests
   - Start with backend models and test generation
   - Build Bluebook-faithful frontend UI
   - Implement SAT scoring algorithm
3. **Parallel**: Continue mapping Practice Tests 1, 2, 3, 5, 6 (can do during development)

---

## Why This Plan Works

1. **Focuses on guarantee requirements first** - Can't launch guarantee without practice tests and study plans
2. **Validates score improvement** - Full-length tests prove the platform works
3. **Clear compliance tracking** - Platform documents student effort (protects from bad-faith refund requests)
4. **Scalable foundation** - Phase 3 prepares for 10+ students without manual overhead
5. **Based on proven model** - Princeton Review's guarantee has worked for decades

**Bottom line**: ~6 weeks to MVP (Phase 1), ~15 weeks to fully mature platform ready for serious scale.
