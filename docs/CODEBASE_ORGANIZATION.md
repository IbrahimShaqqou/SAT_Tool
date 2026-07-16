# SAT Tool - Codebase Organization

## 📁 Project Structure

```
SAT_Tool/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   └── v1/            # API v1 endpoints
│   │   │       ├── live.py           # ✨ NEW: Live session endpoints
│   │   │       └── ...
│   │   ├── core/              # Core utilities
│   │   │   ├── live_ticket.py        # ✨ NEW: WebSocket auth tickets
│   │   │   └── ...
│   │   ├── models/            # SQLAlchemy models
│   │   │   ├── practice_test.py      # ✨ NEW: Practice test definitions
│   │   │   ├── question.py           # Question bank
│   │   │   ├── test.py               # Test sessions
│   │   │   ├── user.py               # Users
│   │   │   └── ...
│   │   ├── schemas/           # Pydantic schemas
│   │   │   ├── live.py               # ✨ NEW: Live message + token schemas
│   │   │   └── ...
│   │   ├── services/          # Business logic
│   │   │   ├── sat_scoring.py        # ✨ NEW: SAT scoring algorithm
│   │   │   └── ...
│   │   └── database.py        # Database connection
│   ├── alembic/               # Database migrations
│   │   └── versions/          # Migration files
│   │       └── 20260522_practice_tests.py  # ✨ NEW
│   ├── data/                  # Data files
│   │   ├── math_core.json            # 1,756 math questions
│   │   ├── reading_core.json         # 1,590 R/W questions
│   │   └── practice_test_mappings/   # ✨ NEW: Official test mappings
│   │       ├── practice_test_4_modules_1_2_easy.json
│   │       ├── practice_test_4_modules_1_2_hard.json
│   │       ├── README.md
│   │       ├── STATUS.md
│   │       └── *.tar.gz (backups)
│   └── scripts/               # Utility scripts
│       ├── seed_practice_test_4.py         # ✨ NEW
│       ├── match_practice_test.py          # ✨ NEW
│       ├── match_practice_test_hard.py     # ✨ NEW
│       ├── mypractice_console_extractor.js # ✨ NEW
│       └── ...
│
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── student/       # Student views
│   │   │   ├── tutor/         # Tutor views
│   │   │   │   ├── LiveSessionsPage.jsx  # ✨ NEW: Live sessions list + watch view
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── components/        # Reusable components
│   │   │   ├── live/                 # ✨ NEW: Live session UI
│   │   │   │   ├── LiveIndicator.jsx
│   │   │   │   ├── LiveStrokeLayer.jsx
│   │   │   │   ├── SharedDrawingSurface.jsx  # ✨ NEW: Symmetric bidirectional drawing canvas
│   │   │   │   ├── TutorLivePanel.jsx
│   │   │   │   ├── liveFormat.js
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── services/          # API client
│   │   │   ├── liveService.js        # ✨ NEW: WebSocket wrapper + ticket fetch
│   │   │   └── ...
│   │   ├── hooks/             # Custom hooks
│   │   │   ├── useLiveSession.js     # ✨ NEW: WebSocket lifecycle
│   │   │   ├── useStudentLiveEmit.js # ✨ NEW: Student emit hook
│   │   │   ├── useSharedDrawing.js   # ✨ NEW: Shared whiteboard state (merged strokes, undo/clear, sync)
│   │   │   └── ...
│   │   ├── utils/             # Utilities
│   │   │   ├── strokeRenderer.js     # ✨ NEW: Shared canvas stroke renderer
│   │   │   ├── liveCoords.js         # ✨ NEW: Normalized content-anchored stroke coordinates
│   │   │   └── ...
│   │   └── ...
│   └── ...
│
├── docs/                      # 📚 Documentation (ORGANIZED)
│   ├── planning/              # ✨ NEW: Planning documents
│   │   ├── PLATFORM_OVERHAUL_SUMMARY.md   # Business plan & roadmap
│   │   ├── PLATFORM_CAPABILITIES.md       # Current features
│   │   └── DEPLOYMENT_AND_ROADMAP.md      # Deployment guide
│   ├── implementation/        # ✨ NEW: Implementation docs
│   │   ├── PRACTICE_TEST_IMPLEMENTATION_STATUS.md  # Phase 1.1 status
│   │   └── SCORING_ALGORITHM_DISCUSSION.md         # Scoring research
│   ├── audits/                # ✨ NEW: Audit reports
│   │   ├── INF_AUDIT_REPORT.md
│   │   ├── HE_AUDIT_REPORT.md
│   │   ├── hd-audit-report.md
│   │   └── AUDIT_FIXES_COMPLETE.md
│   ├── archive/               # ✨ NEW: Old docs
│   │   ├── practice-test-mapping-research.md
│   │   └── FINAL-practice-test-mapping-research.md
│   ├── legacy/                # ✨ NEW: Deprecated docs
│   │   └── TODO.md
│   ├── ADAPTIVE_SYSTEM_PLAN.md           # Adaptive testing design
│   ├── adaptive-implementation-plan.md   # Implementation details
│   ├── bluebook-interface-spec.md        # UI specifications
│   ├── full-length-test-implementation.md # Test system design
│   ├── sat-adaptive-testing-research.md  # SAT structure research
│   ├── DATABASE.md                       # Database schema
│   ├── DATA_IMPORT.md                    # Data import guide
│   └── CODEBASE_ORGANIZATION.md          # ✨ THIS FILE
│
├── archive/                   # ✨ NEW: Archived files
│   └── old_databases/         # Old SQLite files (unused)
│
├── .env                       # Environment variables
├── README.md                  # Project README
└── requirements.txt           # Python dependencies
```

---

## 🗂️ Key Directories Explained

### `/backend/app/models/`
SQLAlchemy ORM models representing database tables.

**Recently Added**:
- `practice_test.py` - Official College Board practice test definitions
  - `PracticeTest` - Test metadata
  - `PracticeTestModule` - Module-level question mappings
- ✨ NEW: Live session models (schemas defined in `app/schemas/live.py`)

### `/backend/app/services/`
Business logic separated from API routes.

**Recently Added**:
- `sat_scoring.py` - SAT scoring algorithm
  - `should_get_harder_module_2()` - Adaptive threshold (55%)
  - `calculate_sat_section_score()` - Raw → scaled (200-800)
  - `score_full_length_test()` - Complete test scoring
- `live_room_manager.py` - ✨ NEW: In-memory live room registry (relay/broadcast)

### `/backend/data/practice_test_mappings/`
**✨ NEW**: Official SAT practice test question mappings.

**Files**:
- `practice_test_4_modules_1_2_easy.json` - Easy Module 2 variant (98 questions)
- `practice_test_4_modules_1_2_hard.json` - Hard Module 2 variant (98 questions)
- `README.md` - Mapping format documentation
- `STATUS.md` - Extraction progress tracker
- `*.tar.gz` - Compressed backups

**Structure**:
```json
{
  "test_number": 4,
  "rw_module_1": ["uId1", "uId2", ...],          // 27 questions
  "rw_module_2_easier": ["uId3", ...],           // 27 questions
  "rw_module_2_harder": ["uId4", ...],           // 27 questions (different)
  "math_module_1": ["uId5", ...],                // 22 questions
  "math_module_2_easier": ["uId6", ...],         // 22 questions
  "math_module_2_harder": ["uId7", ...],         // 22 questions (different)
  "matches": [...]                                // Detailed match metadata
}
```

### `/backend/scripts/`
Utility scripts for data processing and seeding.

**Recently Added**:
- `seed_practice_test_4.py` - Load Practice Test 4 into database
- `match_practice_test.py` - Fuzzy match extracted questions to database
- `match_practice_test_hard.py` - Match harder variant
- `mypractice_console_extractor.js` - Browser console script for extraction
- `merge_manual_matches.py` - Add manual matches
- `merge_manual_matches_hard.py` - Add manual matches (hard variant)

### `/docs/`
**✨ REORGANIZED**: All documentation now organized by purpose.

#### `/docs/planning/`
High-level planning and roadmap documents:
- Business model (money-back guarantee)
- Feature roadmap (Phases 1-3)
- Deployment strategy

#### `/docs/implementation/`
Technical implementation details:
- Practice test system status
- Scoring algorithm research & decisions
- API specifications (coming soon)

#### `/docs/audits/`
Quality assurance audit reports:
- Question bank audits
- Bug fixes
- Data validation

#### `/docs/archive/`
Old/superseded documentation:
- Early research documents
- Deprecated plans

---

## 🗄️ Database Tables

### Existing Tables
- `users` - Students and tutors
- `questions` - 3,346 College Board questions
- `test_sessions` - Test-taking sessions
- `student_responses` - Question answers
- `assignments` - Tutor assignments
- `skills` - 29 SAT skills
- `student_skill_mastery` - Mastery tracking

### ✨ New Tables (Phase 1.1)
- `practice_tests` - Official practice test definitions
- `practice_test_modules` - Module-level question mappings

**Status**: ✅ Migrated, ✅ Seeded with Practice Test 4

---

## 📊 Data Assets

### Question Bank
- **Total**: 3,346 questions from College Board
- **Math**: 1,756 questions (`data/math_core.json`)
- **Reading/Writing**: 1,590 questions (`data/reading_core.json`)
- **Source**: College Board Question Bank API
- **Format**: JSON with full content, metadata, explanations

### Practice Test Mappings
- **Practice Test 4**: 147 unique questions mapped
  - Module 1: 49 questions (shared between easy/hard)
  - Module 2 Easy: 49 questions
  - Module 2 Hard: 49 questions (different from easy)
- **Match Rate**: 100% (all questions mapped to database)
- **Tests Remaining**: 5 (Tests 1, 2, 3, 5, 6)

---

## 🚀 Recent Changes (Phase 1.1)

### Database Schema
✅ Added `practice_tests` table
✅ Added `practice_test_modules` table
✅ Migration: `20260522_practice_tests.py`

### Backend Code
✅ Created `app/models/practice_test.py`
✅ Created `app/services/sat_scoring.py`
✅ Created seeding scripts

### Data
✅ Extracted Practice Test 4 (easy variant)
✅ Extracted Practice Test 4 (hard variant)
✅ Mapped 147 unique questions
✅ Seeded into database

### Documentation
✅ Reorganized `/docs/` directory
✅ Created implementation status doc
✅ Created scoring algorithm discussion doc
✅ Archived old/deprecated docs

---

## 🎯 Next Steps (Phase 1.1 Completion)

### API Endpoints (In Progress)
- [ ] `GET /api/practice-tests` - List available tests
- [ ] `POST /api/practice-tests/{id}/start` - Start test session
- [ ] `POST /api/practice-tests/sessions/{id}/submit-module` - Submit module
- [ ] `GET /api/practice-tests/sessions/{id}/results` - Get scored results

### Frontend (To Do)
- [ ] Practice test list page
- [ ] Test taking interface (Bluebook-style)
- [ ] Timer component
- [ ] Break screens
- [ ] Score report page

### Testing
- [ ] Manual test: Take Practice Test 4
- [ ] Verify scoring accuracy
- [ ] Test adaptive branching

---

## 📝 Naming Conventions

### Files
- `snake_case.py` - Python modules
- `PascalCase.jsx` - React components
- `SCREAMING_SNAKE_CASE.md` - Documentation
- `kebab-case.md` - Technical specs

### Database
- `snake_case` - Table names
- `snake_case` - Column names
- `PascalCase` - Model class names

### API
- `/kebab-case` - URL paths
- `camelCase` - JSON keys (frontend)
- `snake_case` - JSON keys (backend/database)

---

## 🔧 Development Workflow

### Running Migrations
```bash
cd backend
python3 -m alembic upgrade head
```

### Seeding Data
```bash
cd backend
python3 scripts/seed_practice_test_4.py
```

### Running Backend
```bash
cd backend
uvicorn app.main:app --reload
```

### Running Frontend
```bash
cd frontend
npm run dev
```

---

## 📚 Documentation Quick Links

### Planning & Roadmap
- [Platform Overhaul Summary](planning/PLATFORM_OVERHAUL_SUMMARY.md) - Complete business plan
- [Platform Capabilities](planning/PLATFORM_CAPABILITIES.md) - Current features
- [Deployment Guide](planning/DEPLOYMENT_AND_ROADMAP.md) - How to deploy

### Implementation
- [Practice Test Status](implementation/PRACTICE_TEST_IMPLEMENTATION_STATUS.md) - Phase 1.1 progress
- [Scoring Algorithm](implementation/SCORING_ALGORITHM_DISCUSSION.md) - How scoring works

### Technical Specs
- [SAT Research](sat-adaptive-testing-research.md) - Digital SAT structure
- [Bluebook Interface](bluebook-interface-spec.md) - UI design
- [Database Schema](DATABASE.md) - Database structure

---

## 🎉 Recent Milestones

- ✅ **2026-05-22**: Practice Test 4 fully mapped and seeded
- ✅ **2026-05-22**: SAT scoring algorithm implemented
- ✅ **2026-05-22**: Documentation reorganized
- ✅ **2026-05-21**: Comprehensive QA audit (3,271 questions)
- ✅ **2026-04-19**: Question bank normalized (3,346 questions)

---

**Last Updated**: 2026-05-22
**Status**: Phase 1.1 (Backend Complete, API In Progress)
