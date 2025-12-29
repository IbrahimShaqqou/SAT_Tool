# SAT Tutoring Platform - Complete Capabilities Reference

> **Last Updated**: December 2024
> **Purpose**: Reference document for future development sessions describing what each feature does, how it works, and its current implementation status.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Summary](#architecture-summary)
3. [Authentication & Users](#authentication--users)
4. [Question Bank & Taxonomy](#question-bank--taxonomy)
5. [IRT (Item Response Theory) System](#irt-item-response-theory-system)
6. [Student Features](#student-features)
7. [Tutor Features](#tutor-features)
8. [Public Assessments (Intake)](#public-assessments-intake)
9. [Adaptive Testing](#adaptive-testing)
10. [Database Schema Summary](#database-schema-summary)
11. [API Endpoints Reference](#api-endpoints-reference)
12. [Current Limitations & Known Gaps](#current-limitations--known-gaps)

---

## Project Overview

The SAT Tutoring Platform is a web application for personalized SAT test preparation. It uses **Item Response Theory (IRT)** to:
- Estimate student ability per skill
- Select questions adaptively based on student level
- Track mastery progression over time
- Predict SAT scores

### Tech Stack
- **Backend**: FastAPI (Python), SQLAlchemy ORM, PostgreSQL
- **Frontend**: React, React Router, Tailwind CSS, Recharts
- **Auth**: JWT tokens (access + refresh)
- **Deployment**: Docker Compose

### Key Directories
```
backend/
├── app/
│   ├── api/v1/          # API endpoints
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic validation
│   ├── services/        # Business logic (IRT, intake)
│   └── core/            # Config, security

frontend/
├── src/
│   ├── pages/           # Route components
│   ├── components/      # Reusable UI
│   ├── services/        # API client
│   └── hooks/           # Custom React hooks
```

---

## Architecture Summary

### Data Flow
```
Student answers question
    ↓
StudentResponse created (with time, answer)
    ↓
IRT calculates new ability (EAP estimation)
    ↓
StudentSkill updated (theta, mastery_level)
    ↓
Propagates to StudentDomainAbility
    ↓
Propagates to StudentSectionAbility (with SAT score prediction)
```

### Ability Hierarchy
```
StudentSectionAbility (Math or Reading/Writing) → SAT Score Prediction
    ↑ aggregated from
StudentDomainAbility (7 domains: 4 Math + 3 Reading)
    ↑ aggregated from
StudentSkill (80+ skills, atomic mastery unit)
    ↑ estimated from
StudentResponse (individual answers with IRT parameters)
```

---

## Authentication & Users

### Implementation Status: **COMPLETE**

### Features
| Feature | Status | How It Works |
|---------|--------|--------------|
| Registration | Complete | Email, password, name, role selection (student/tutor) |
| Login | Complete | OAuth2 password flow, returns JWT access + refresh tokens |
| Token Refresh | Complete | Use refresh token to get new access token |
| Profile Management | Complete | Update name, profile data |
| Role-Based Access | Complete | AuthGuard component, `get_current_tutor` dependency |

### User Model Fields
- `id` (UUID), `email` (unique), `password_hash`
- `first_name`, `last_name`, `role` (student/tutor/admin)
- `is_active`, `is_verified`, `last_login_at`
- `tutor_id` (FK for student-tutor relationship)
- `profile_data` (JSONB for role-specific settings)

### API Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/auth/register` | None | Create account |
| POST | `/api/v1/auth/login` | None | Get JWT tokens |
| POST | `/api/v1/auth/refresh` | None | Refresh access token |
| GET | `/api/v1/auth/me` | Required | Get current user |
| PATCH | `/api/v1/auth/me` | Required | Update profile |

---

## Question Bank & Taxonomy

### Implementation Status: **COMPLETE**

### Question Database
- **3,271 questions** imported from College Board
- **2 subjects**: Math (40 questions per intake), Reading & Writing (40 questions per intake)
- **Answer types**: MCQ (Multiple Choice, 4 options), SPR (Student-Produced Response)
- **Difficulty levels**: Easy (E), Medium (M), Hard (H)

### Question Model Fields
- `id` (UUID), `external_id` (College Board ID)
- `subject_area`, `domain_id`, `skill_id`
- `answer_type`, `difficulty`, `score_band_range` (1-8)
- `prompt_html`, `choices_json`, `correct_answer_json`, `explanation_html`
- **IRT Parameters**: `irt_difficulty_b`, `irt_discrimination_a`, `irt_guessing_c`

### Taxonomy Hierarchy
```
Subject Area (Math / Reading & Writing)
    └── Domain (7 total)
        └── Skill (80+ total, atomic unit)
```

**Math Domains** (4):
- H: Algebra
- P: Problem Solving and Data Analysis
- Q: Advanced Math
- S: Geometry and Trigonometry

**Reading & Writing Domains** (3 active):
- INI: Information and Ideas
- CAS: Craft and Structure
- EOI: Expression of Ideas
- SEC: Standard English Conventions (placeholder)

### API Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/questions` | None | List questions (paginated, filtered) |
| GET | `/api/v1/questions/random` | None | Get random questions |
| GET | `/api/v1/questions/{id}` | None | Get single question with explanation |
| GET | `/api/v1/domains` | None | List all domains |
| GET | `/api/v1/domains/{id}/skills` | None | List skills in domain |
| GET | `/api/v1/skills` | None | List all skills |

---

## IRT (Item Response Theory) System

### Implementation Status: **COMPLETE**

### 3PL Model
The platform uses a **3-Parameter Logistic (3PL) IRT model**:

```
P(correct | θ, a, b, c) = c + (1-c) / (1 + exp(-a × (θ - b)))
```

**Parameters**:
- **θ (theta)**: Student ability (-4 to +4, centered at 0)
- **a**: Discrimination (0.5-2.5) - how well item differentiates ability levels
- **b**: Difficulty (-3 to +3) - ability level for 50% success chance
- **c**: Guessing (0.25 for MCQ, 0.0 for SPR)

### Parameter Initialization (from College Board data)
```python
# Difficulty (b) from score_band_range (1-8)
b = (score_band - 4.5) × (5.0 / 7.0)  # Maps to -2.5 to +2.5

# Discrimination (a) from difficulty level
a = {"EASY": 0.8, "MEDIUM": 1.2, "HARD": 1.5}

# Guessing (c) from answer type
c = 0.25 if MCQ else 0.0
```

### Ability Estimation Methods

**EAP (Expected A Posteriori)** - Primary method
- Bayesian posterior integration with Normal(0, 1) prior
- More stable with few responses
- Used for all skill/domain/section estimates

**MLE (Maximum Likelihood Estimation)** - Available but secondary
- Newton-Raphson iteration
- More precise with many responses

### Mastery Calculation
```python
# Convert theta to base mastery (0-100)
theta_mastery = 50 + (theta × 17.5)

# Cap based on average difficulty of questions answered
# Prevents 100% mastery from only easy questions
difficulty_cap = 75 + (avg_difficulty × 13.3)

# Apply cap
mastery = min(theta_mastery, difficulty_cap)

# Accuracy floor (high performers get minimum)
if accuracy >= 90%: mastery = max(mastery, 40)
```

### Key IRT Functions (in `irt_service.py`)
| Function | Purpose |
|----------|---------|
| `probability_correct(theta, a, b, c)` | 3PL probability calculation |
| `item_information(theta, a, b, c)` | Fisher information for question selection |
| `estimate_ability_eap(responses)` | Bayesian ability estimation |
| `update_skill_ability(db, student_id, skill_id, responses)` | Update student's skill theta |
| `propagate_ability_updates(db, student_id, skill_id)` | Bubble up to domain/section |
| `select_adaptive_question(theta, questions, ...)` | Pick most informative question |

### Theta Decay (Stale Skills)
- **14-day grace period**: No decay
- **After grace**: 5% decay toward 0 per week
- Encourages spaced repetition practice

---

## Student Features

### Student Dashboard (`/student`)

**Implementation Status**: **COMPLETE**

**Features**:
- Quick stats: Overall accuracy, questions answered, sessions completed
- In-progress assessments banner (resume incomplete intake assessments)
- Adaptive Practice CTA card
- Areas to Improve section (weak skills with "Practice" buttons)
- Your Strengths section (top 3 strong skills)
- Pending assignments list

**API Calls**:
- `GET /progress/summary` - Stats
- `GET /progress/in-progress` - Resumable assessments
- `GET /progress/skills` - Weak/strong skills
- `GET /assignments?status=pending&limit=5` - Assignments

### Student Assignments (`/student/assignments`)

**Implementation Status**: **COMPLETE**

**Features**:
- View all assignments with tabs: All, Pending, In Progress, Completed
- Assignment cards with status, progress, due date
- Start/Continue/View Results buttons

### Test Taking (`/student/test/:id`)

**Implementation Status**: **COMPLETE**

**Features**:
- Full SAT-realistic interface
- Question display with HTML rendering
- MCQ answer choices (A, B, C, D) or SPR text input
- Timer with pause/resume
- Desmos graphing calculator (for math)
- Split-pane layout for reading passages
- Question navigator with answered/flagged status
- Mark for review toggle
- Auto-submit on time limit
- **Adaptive mode**: Simplified navigation, immediate feedback, ability updates

### Results Review (`/student/results/:id`)

**Implementation Status**: **COMPLETE**

**Features**:
- Overall score percentage and progress bar
- Correct/incorrect breakdown
- Question-by-question review with expandable explanations
- Color-coded borders (green correct, red incorrect)

### Adaptive Practice (`/student/adaptive`)

**Implementation Status**: **COMPLETE**

**Three Phases**:

1. **Setup Phase**
   - Skill selector (grouped by domain, checkboxes)
   - Question count selection (5, 10, 15, 20)
   - "How it works" explanation card

2. **Practice Phase**
   - Single question interface (no full navigator)
   - "Check Answer" button → shows explanation
   - Ability estimate updates displayed
   - "Next Question" / "Finish" buttons
   - Desmos calculator available

3. **Results Phase**
   - Score percentage and encouragement message
   - Skill progress summary
   - "Practice Again" or "Dashboard" options

**Key Backend Flow**:
```
POST /adaptive/sessions {skill_ids, question_count}
POST /adaptive/sessions/{id}/start → first question
POST /adaptive/sessions/{id}/answer → grades, updates theta, returns next question
POST /adaptive/sessions/{id}/complete → final results with ability growth
```

---

## Tutor Features

### Tutor Dashboard (`/tutor`)

**Implementation Status**: **COMPLETE**

**Features**:
- Quick stats: Total students, active this week, completion rate, avg score
- Recent students list (top 5)
- Common struggles section (skills where students need help)
- "Invite Student" CTA

### Student Roster (`/tutor/students`)

**Implementation Status**: **COMPLETE**

**Features**:
- Searchable student table with:
  - Name, email, accuracy badge (color-coded)
  - Questions answered, pending assignments
  - Last active date
- Add student by email modal
- Click row → student detail page

### Student Detail (`/tutor/students/:id`)

**Implementation Status**: **COMPLETE**

**4 Tabs**:

1. **Domain Mastery** - Domain cards with accuracy, mastery level, top skills
2. **Skill Details** - All skills with accuracy, theta values, grid layout
3. **Focus Areas** - Weak skills prioritized, recommendations, "Create Assignment" link
4. **Trends** - Accuracy trend chart (30 days), top skills breakdown chart

**API Calls**:
- `GET /tutor/students/{id}` - Profile
- `GET /tutor/students/{id}/progress` - Skills, domains
- `GET /tutor/students/{id}/weaknesses` - Priority recommendations
- `GET /tutor/students/{id}/charts?days=30` - Chart data

### Assignments Management (`/tutor/assignments`)

**Implementation Status**: **COMPLETE**

**Features**:
- Assignments table: title, student, status, progress, due date
- Click "Create Assignment" → new assignment page

### Create Assignment (`/tutor/assignments/new`)

**Implementation Status**: **COMPLETE**

**Form Fields**:
- Student dropdown (from roster)
- Title, Instructions
- Subject (Math / Reading & Writing)
- Question count (1-50)
- **Adaptive Mode Toggle** - Use IRT for question selection
- Domain filter (optional)
- Skill filter (optional, loads when domain selected)
- Time limit (optional)
- Due date (optional)

### Analytics Dashboard (`/tutor/analytics`)

**Implementation Status**: **COMPLETE**

**3 Tabs**:

1. **Overview**
   - Class performance trend (line chart, 30 days)
   - Domain coverage (radar chart)
   - Score distribution (histogram)
   - Common struggles list

2. **Skills** - Skill performance bar chart (top 10 by practice volume)

3. **Activity** - Practice activity heatmap (12 weeks)

### Invite Links (`/tutor/invites`)

**Implementation Status**: **COMPLETE**

**Create Invite Modal**:
- Title (optional)
- Assessment type: Intake (full), Section (5 per domain), Quick Check (3 questions)
- Subject area
- Auto-calculated question count and estimated time
- Time limit (optional)
- Expiration days (optional)
- Generates shareable link with copy button

**Invite Table**:
- Title, subject, question count, status badge
- Result score (if used), student name (links to profile if registered)
- Actions: Copy link, Revoke, View results

**Results Modal**:
- Overall score and percentage
- Section scores with SAT predictions
- Domain breakdown with ability estimates
- Priority areas for improvement

---

## Public Assessments (Intake)

### Implementation Status: **COMPLETE**

### Assessment Page (`/assess/:token`)

**States**:
1. **Loading** - Fetching assessment config
2. **Error** - Token invalid, expired, or revoked
3. **Auth Required** - Login or Register forms
4. **Intro** - Assessment preview with tips, Start button
5. **In Progress** - Full test interface
6. **Submitting** - Processing submission
7. **Completed** - Score summary with "View Results" button

**Features**:
- Works for logged-in users OR guest registration
- State persistence (resume from where left off)
- Answer and flag restoration on resume
- Full SAT-style test interface

### Intake Results Page (`/assess/:token/results`)

**Implementation Status**: **COMPLETE**

**Sections**:
- Overall score and predicted SAT (with range)
- Section performance (Math, Reading & Writing) with predictions
- Priority areas with recommendations and Practice buttons
- Domain breakdown with color-coded progress bars

**Tabs**:
- **Overview** - Summary with correct/incorrect lists
- **Question Review** - Expandable cards with:
  - Question prompt and passage
  - Answer choices marked (student answer, correct answer)
  - Explanation (collapsible)
  - Domain and skill tags

### Intake Question Selection Algorithm

**Location**: `intake_service.py` → `select_intake_questions()`

**Key Innovation**: Ensures each **skill** gets questions at multiple difficulty levels (not just domain-level spread).

**Process**:
1. Group available questions by skill
2. Distribute evenly (2+ questions per skill with questions)
3. For each skill: select easy + hard (guaranteed spread)
4. Order in CAT style: medium first, then alternate easy/hard

**Why**: Getting all easy questions right shouldn't give 100% mastery. Need difficulty variety for accurate theta estimation.

### Storing Intake Results

**Location**: `intake_service.py` → `store_intake_abilities()`

**What it does**:
1. Groups responses by skill
2. Calls `update_skill_ability()` for each skill
3. Calls `propagate_ability_updates()` to update domain/section
4. Commits all StudentSkill, StudentDomainAbility, StudentSectionAbility records

---

## Adaptive Testing

### Implementation Status: **COMPLETE**

### Cross-Session Memory

**Purpose**: Prevent question repetition across sessions

**Settings** (per student, tutor-configurable):
- `repetition_time_days` (default 7): No repeat within N days
- `repetition_question_count` (default 30): No repeat until N other questions answered

**Implementation**: `get_recently_seen_question_ids()` checks BOTH constraints

### Adaptive Question Selection

**Location**: `irt_service.py` → `select_adaptive_question_with_memory()`

**Algorithm**:
1. Filter out recently seen questions (cross-session memory)
2. Score each by **Fisher Information** at current theta
3. Apply **progressive challenge**: increase target difficulty as session progresses
4. **Test the water** (15% chance): try much harder question
5. **Difficulty diversity**: spread selections across b values
6. Select from top 3 most informative (with randomization)

### Session Aggressiveness

**Short sessions** (≤5 questions): 1.5x weight on theta updates (aggressive)
**Medium** (6-10): 1.2x
**Normal** (11-20): 1.0x
**Long** (>20): 0.8x (conservative)

### API Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/adaptive/ability-profile` | Required | Full ability profile |
| GET | `/adaptive/skill-ability/{id}` | Required | Single skill ability |
| POST | `/adaptive/next-question` | Required | Get next adaptive question |
| POST | `/adaptive/sessions` | Required | Create adaptive session |
| POST | `/adaptive/sessions/{id}/start` | Required | Start session, get first question |
| POST | `/adaptive/sessions/{id}/answer` | Required | Submit answer, get ability update + next |
| POST | `/adaptive/sessions/{id}/complete` | Required | Get final results |
| GET | `/adaptive/students/{id}/stale-skills` | Required | Get inactive skills |
| GET | `/adaptive/students/{id}/hierarchical-profile` | Required | Full skill/domain/section breakdown |

---

## Database Schema Summary

### Core Models

| Model | Table | Purpose |
|-------|-------|---------|
| User | users | All users (students, tutors, admins) |
| Question | questions | Question content + IRT parameters |
| Domain | domains | Top-level taxonomy (7 total) |
| Skill | skills | Atomic taxonomy unit (80+) |
| StudentResponse | student_responses | Individual answer records |
| StudentSkill | student_skills | Per-skill mastery tracking |
| TestSession | test_sessions | Test/practice attempt container |
| TestQuestion | test_questions | Question-to-session mapping with order |
| Assignment | assignments | Tutor-created tasks |
| Invite | invites | Assessment invite links |

### Adaptive Models

| Model | Table | Purpose |
|-------|-------|---------|
| StudentAdaptiveSettings | student_adaptive_settings | Per-student adaptive config |
| StudentDomainAbility | student_domain_abilities | Domain-level theta aggregation |
| StudentSectionAbility | student_section_abilities | Section-level theta + SAT prediction |

### Key Relationships

```
User ──< StudentResponse >── Question
User ──< StudentSkill >── Skill
User ──< TestSession ──< TestQuestion >── Question
User ──< Assignment ──< AssignmentQuestion >── Question
User ──< Invite
Skill >── Domain
Question >── Skill
```

---

## API Endpoints Reference

### Authentication (`/api/v1/auth`)
- POST `/register` - Create account
- POST `/login` - Get tokens
- POST `/refresh` - Refresh token
- GET `/me` - Current user
- PATCH `/me` - Update profile

### Questions (`/api/v1/questions`)
- GET `/` - List (paginated, filtered)
- GET `/random` - Random questions
- GET `/{id}` - Single question

### Taxonomy (`/api/v1`)
- GET `/domains` - All domains
- GET `/domains/{id}` - Single domain
- GET `/domains/{id}/skills` - Skills in domain
- GET `/skills` - All skills
- GET `/skills/{id}` - Single skill

### Practice (`/api/v1/practice`)
- POST `/` - Create session
- GET `/` - List sessions
- GET `/{id}` - Session details
- POST `/{id}/start` - Start
- POST `/{id}/answer` - Submit answer
- POST `/{id}/pause` - Pause
- POST `/{id}/resume` - Resume
- POST `/{id}/complete` - Complete
- GET `/{id}/results` - Get results

### Progress (`/api/v1/progress`)
- GET `/summary` - Overall stats
- GET `/history` - Response history
- GET `/in-progress` - Resumable assessments
- GET `/skills` - Skill abilities (weak/strong)

### Assignments (`/api/v1/assignments`)
- POST `/` - Create (tutor)
- GET `/` - List
- GET `/{id}` - Details
- PATCH `/{id}` - Update (tutor)
- DELETE `/{id}` - Delete (tutor)
- POST `/{id}/start` - Start (student)
- POST `/{id}/answer` - Submit answer
- POST `/{id}/submit` - Complete
- GET `/{id}/questions` - All questions

### Tutor (`/api/v1/tutor`)
- GET `/students` - Student roster
- POST `/students` - Add student
- DELETE `/students/{id}` - Remove student
- GET `/students/{id}` - Student profile
- GET `/students/{id}/progress` - Student progress
- GET `/students/{id}/sessions` - Student sessions
- GET `/students/{id}/responses` - Student responses
- GET `/students/{id}/weaknesses` - Weak skills
- GET `/analytics` - Class analytics
- GET `/charts` - Chart data
- GET `/students/{id}/charts` - Student charts
- POST `/invites` - Create invite
- GET `/invites` - List invites
- GET `/invites/{id}` - Invite details
- GET `/invites/{id}/results` - Invite results
- DELETE `/invites/{id}` - Revoke invite

### Public Assessment (`/api/v1/assess`)
- GET `/{token}` - Get config
- POST `/{token}/start` - Start/resume
- GET `/{token}/questions` - Get questions
- POST `/{token}/answer` - Submit answer
- POST `/{token}/submit` - Complete
- GET `/{token}/results` - Get results
- GET `/{token}/answers` - Get saved answers
- POST `/{token}/state` - Update position
- POST `/{token}/flag/{qid}` - Toggle flag
- GET `/{token}/review` - Question-by-question review

### Adaptive (`/api/v1/adaptive`)
- GET `/ability-profile` - Full profile
- GET `/skill-ability/{id}` - Skill ability
- POST `/next-question` - Get next question
- POST `/sessions` - Create session
- POST `/sessions/{id}/start` - Start
- GET `/sessions/{id}` - Details
- POST `/sessions/{id}/answer` - Submit answer
- POST `/sessions/{id}/complete` - Complete
- GET `/calibration/stats` - IRT stats
- POST `/calibration/initialize` - Initialize IRT params
- GET `/students/{id}/stale-skills` - Inactive skills
- GET `/students/{id}/hierarchical-profile` - Full hierarchy

---

## Current Limitations & Known Gaps

### Implemented But Could Be Enhanced

| Feature | Current State | Enhancement Opportunity |
|---------|---------------|------------------------|
| IRT Parameters | Initialized from heuristics | Empirical calibration from response data |
| SAT Score Prediction | Simple theta-to-score mapping | More sophisticated prediction model |
| Question Bank | 3,271 questions | Import more, allow manual creation |
| Time Decay | 5% per week | Configurable decay curves |
| Explanations | HTML from import | Rich step-by-step solutions |

### Not Yet Implemented

| Feature | Description | Priority |
|---------|-------------|----------|
| Admin Dashboard | Manage users, questions, system settings | Medium |
| Question Editor | Add/edit questions via UI | Medium |
| Mobile Optimization | Responsive improvements for phone/tablet | Low |
| Study Plan Generator | AI-generated weekly study plans | Low |
| Comparative Analytics | Percentiles, cohort comparison | Low |
| Email Notifications | Due date reminders, progress reports | Low |
| SSO / OAuth | Google, Apple sign-in | Low |

### Technical Debt

| Item | Description |
|------|-------------|
| Test Coverage | Need comprehensive IRT calculation tests |
| Error Handling | Some API errors return generic messages |
| Logging | Add structured logging for debugging |
| Performance | Optimize queries for large question pools |

---

## Quick Reference: Key Files

### Backend Services
- `backend/app/services/irt_service.py` - All IRT calculations, ability estimation, adaptive selection
- `backend/app/services/intake_service.py` - Intake question selection, results calculation
- `backend/app/services/irt_calibration.py` - IRT parameter initialization

### Backend API
- `backend/app/api/v1/adaptive.py` - Adaptive testing endpoints
- `backend/app/api/v1/assess.py` - Public assessment endpoints
- `backend/app/api/v1/progress.py` - Student progress endpoints
- `backend/app/api/v1/tutor.py` - Tutor dashboard endpoints

### Frontend Pages
- `frontend/src/pages/student/AdaptivePracticePage.jsx` - Adaptive practice UI
- `frontend/src/pages/student/TestPage.jsx` - Test-taking interface
- `frontend/src/pages/assess/AssessmentPage.jsx` - Public assessment
- `frontend/src/pages/assess/IntakeResultsPage.jsx` - Detailed results
- `frontend/src/pages/tutor/StudentDetailPage.jsx` - Student analytics

### Database Models
- `backend/app/models/question.py` - Question with IRT fields
- `backend/app/models/response.py` - StudentResponse, StudentSkill
- `backend/app/models/adaptive.py` - StudentDomainAbility, StudentSectionAbility, StudentAdaptiveSettings

---

*This document should be updated whenever significant features are added or modified.*
