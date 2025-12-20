# SAT Tutoring Platform - Claude Code Instructions

## Project Overview
You are building a production-ready Digital SAT tutoring platform with FastAPI, React, PostgreSQL, and Kubernetes deployment. This is a real product that will be used by tutors and students.

## Tech Stack
- **Backend**: FastAPI (Python 3.11), SQLAlchemy, PostgreSQL, Redis, Celery
- **Frontend**: React 18, Recharts, Tailwind CSS
- **Database**: PostgreSQL 15
- **Deployment**: Docker, Kubernetes, GitHub Actions
- **Testing**: Pytest (backend), Jest (frontend)
- **Monitoring**: Prometheus, Grafana

## Core Architecture Principles

### 1. Database Schema (Already Defined)
```
domains (Math, Reading & Writing)
  ↓
subdomains (Algebra, Advanced Math, etc.)
  ↓
skills (Linear equations in one variable, etc.)
  ↓
questions (Individual SAT questions)
  ↓
student_responses (Track performance per question)
  ↓
student_skills (IRT-based ability estimates per skill)
```

### 2. Key Features Priority
**Phase 1 (MVP)**:
1. User authentication (JWT)
2. Question bank management
3. Practice test system (student interface matching real Digital SAT)
4. Skill-level progress tracking
5. Tutor analytics dashboard

**Phase 2**:
6. IRT adaptive engine
7. Assignment system
8. Recommendation engine

### 3. Student Test Interface Requirements (CRITICAL)
The student test interface MUST match the official Digital SAT exactly:
- Top navigation with section/module info, timer, reference sheet, Desmos calculator
- Progress bar showing test completion
- Question navigator sidebar (answered/flagged/unanswered)
- A/B/C/D radio button options for MCQ
- "Mark for Review" functionality
- Clean, distraction-free layout
- Reference sheet modal with all SAT formulas
- Desmos calculator integration

### 4. Analytics Requirements (CRITICAL)
Tutors need granular skill-level tracking:
- Domain mastery percentage (e.g., Algebra: 75%)
- Subdomain breakdown (e.g., Linear equations: 12/15 questions mastered)
- Individual skill progress with color coding (green ≥80%, yellow ≥60%, red <60%)
- Question-level performance history
- Time spent per question
- Recommended practice areas based on weak skills

## Development Guidelines

### Code Quality Standards
- **Type hints**: Use Python type hints everywhere
- **Docstrings**: Every function needs a docstring
- **Error handling**: Comprehensive try/except blocks with proper logging
- **Testing**: Write tests BEFORE or ALONGSIDE feature code (TDD)
- **Target**: 80%+ code coverage
- **No commented-out code**: Delete it or put in git history
- **Meaningful variable names**: `student_ability_estimate` not `sae`

### API Design
- RESTful endpoints with proper HTTP methods
- Pydantic schemas for request/response validation
- Consistent error responses: `{"detail": "error message", "code": "ERROR_CODE"}`
- JWT authentication on protected endpoints
- Rate limiting on all endpoints
- API versioning: `/api/v1/...`

### Database Best Practices
- Use SQLAlchemy ORM, not raw SQL
- Migrations via Alembic for ALL schema changes
- Foreign keys with proper CASCADE rules
- Indexes on frequently queried columns
- Use database transactions for multi-step operations
- Connection pooling for performance

### Frontend Standards
- Functional components with hooks (no class components)
- Custom hooks for shared logic
- API calls in service files, not components
- Tailwind for styling (utility-first)
- Proper error boundaries
- Loading states for all async operations
- Responsive design (mobile-friendly)

### Security
- Never commit secrets or API keys
- Password hashing with bcrypt (12+ rounds)
- JWT tokens with reasonable expiry (30 min access, 7 day refresh)
- SQL injection prevention via ORM
- XSS protection (sanitize user input)
- CORS properly configured
- Rate limiting to prevent abuse

## File Organization

### Backend Structure
```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings from environment
│   ├── database.py          # DB connection and session
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── api/                 # Route handlers
│   │   ├── deps.py          # Dependencies (auth, db session)
│   │   ├── auth.py
│   │   ├── questions.py
│   │   ├── tests.py
│   │   └── analytics.py
│   ├── core/                # Business logic
│   │   ├── security.py      # JWT, password hashing
│   │   ├── irt.py           # Item Response Theory
│   │   └── recommendations.py
│   └── tests/               # Pytest tests
└── scripts/                 # Utility scripts
```

### Frontend Structure
```
frontend/src/
├── components/
│   ├── common/              # Reusable UI components
│   ├── tutor/               # Tutor dashboard components
│   └── student/             # Student test interface
├── pages/                   # Top-level page components
├── services/                # API calls
├── hooks/                   # Custom React hooks
└── utils/                   # Helper functions
```

## Testing Strategy

### Backend Tests
- **Unit tests**: Test individual functions in isolation
- **Integration tests**: Test API endpoints with test database
- **IRT tests**: Verify adaptive algorithm correctness
- Use pytest fixtures for setup/teardown
- Mock external services (email, third-party APIs)

### Frontend Tests
- **Component tests**: Test UI components in isolation
- **Integration tests**: Test user flows
- **Mock API responses**: Don't hit real backend in tests

## Common Tasks

### Adding a New API Endpoint
1. Create Pydantic schema in `schemas/`
2. Add database model in `models/` if needed
3. Create migration: `alembic revision --autogenerate -m "description"`
4. Implement endpoint in `api/`
5. Add authentication if needed
6. Write tests in `tests/`
7. Update API docs (automatic via FastAPI)

### Adding a New React Component
1. Create component file in appropriate directory
2. Extract API calls to service file
3. Use custom hooks for shared logic
4. Style with Tailwind utilities
5. Add loading and error states
6. Write tests

### Database Changes
1. Modify SQLAlchemy model
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review migration file (autogenerate isn't perfect)
4. Test migration: `alembic upgrade head` then `alembic downgrade -1`
5. Commit migration file

## Important Notes

### Question Bank
The platform includes a complete question bank with 3,271 SAT questions:
- Math: 1,681 questions (1,222 with explanations, 192 with SVG graphs)
- Reading/Writing: 1,590 questions (all with explanations)

Data is stored in `backend/data/` as JSON files and imported into PostgreSQL.

### Question Import Scripts
Three scripts manage the question bank:
- `backend/scripts/fetch_math.py` - Fetches math questions from College Board API
- `backend/scripts/fetch_reading.py` - Fetches reading questions from College Board API
- `backend/scripts/import_questions.py` - Imports normalized JSON into PostgreSQL

These scripts are COMPLETE and WORKING.

To refresh the question bank:
```bash
cd backend
python scripts/fetch_math.py --fresh
python scripts/fetch_reading.py --fresh
python scripts/import_questions.py --all
```

See `backend/docs/DATA_IMPORT.md` for detailed documentation.

### IRT Implementation
Item Response Theory is used for adaptive question selection. The algorithm should:
1. Estimate student ability (θ) based on past responses
2. Select next question to maximize information gain
3. Target ~60% correct rate for optimal learning
4. Update ability estimate after each response

Use the 2-parameter logistic model (2PL):
```
P(correct) = 1 / (1 + exp(-a(θ - b)))
where:
  θ = student ability
  a = question discrimination
  b = question difficulty
```

### Performance Targets
- API response time: <100ms for simple queries, <500ms for complex
- Support 200+ requests/second
- 99.9% uptime in production
- Database query optimization (use EXPLAIN ANALYZE)

## When Asking Claude Code for Help

### Good Prompts
✅ "Implement the /api/v1/tests endpoint with create, retrieve, and submit functionality. Include proper authentication, validation, and tests."

✅ "Add IRT-based question selection to the test engine. Select questions that maximize information gain based on current ability estimate."

✅ "Create the student test interface component matching the Digital SAT layout with timer, question navigator, and reference sheet."

✅ "Set up Alembic migrations for the database schema including domains, subdomains, skills, and questions tables."

### Poor Prompts
❌ "Make the app better"
❌ "Add some features"
❌ "Fix the bugs"

### How to Guide Development
1. **Start with a clear goal**: "I want to build the authentication system"
2. **Let Claude ask questions**: It will clarify requirements
3. **Review code before accepting**: Check for security issues, test coverage
4. **Iterate**: "Now add refresh token functionality"
5. **Request tests**: "Write comprehensive tests for this feature"

## Development Workflow with Claude Code

### Typical Session
```bash
# Start Claude Code
claude-code

# Example conversation:
You: "Set up the FastAPI application structure with database connection, 
     config management, and initial health check endpoint. Include Docker 
     setup and example .env file."

Claude: [Creates files, sets up structure]

You: "Now add user authentication with JWT tokens. Include registration, 
     login, and a protected endpoint example."

Claude: [Implements auth system]

You: "Run the tests"

Claude: [Executes pytest, reports results]

You: "Fix the failing test for password hashing"

Claude: [Debugs and fixes]
```

## Critical Success Factors

1. **Skill-level granularity**: Every question must map to a specific skill
2. **Authentic student experience**: Test interface must match real Digital SAT
3. **Tutor insights**: Analytics must show exactly where students struggle
4. **Production-ready**: Proper error handling, logging, monitoring
5. **Test coverage**: 80%+ coverage before considering feature complete
6. **Documentation**: README files in each major directory

## Questions to Ask Before Starting a Feature

1. How does this feature connect to existing code?
2. What database changes are needed?
3. What are the API endpoints (if any)?
4. What validation is needed?
5. What tests need to be written?
6. What could go wrong (error cases)?
7. How will this be monitored in production?

## Final Notes

This is a REAL product going into production. Code quality matters. Don't cut corners on:
- Security
- Testing
- Error handling
- Performance
- User experience

When in doubt, ask before implementing. It's better to clarify requirements than to build the wrong thing.