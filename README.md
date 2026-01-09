# SAT Tutoring Platform

A production-ready Digital SAT tutoring platform with a comprehensive question bank, skill-level tracking, adaptive practice tests, and tutor analytics.

## Question Bank

The platform includes a complete SAT question bank sourced from College Board:

| Subject | Questions | With Explanations | With Graphs |
|---------|-----------|-------------------|-------------|
| Math | 1,681 | 1,222 (73%) | 192 |
| Reading/Writing | 1,590 | 1,590 (100%) | 54 |
| **Total** | **3,271** | **2,812 (86%)** | **246** |

### Content Types

- **Math Questions**: Includes MathML equations, SVG coordinate planes, function graphs, and geometric figures
- **Reading Questions**: Includes passages, data tables, and charts
- **Explanations**: Detailed worked solutions with step-by-step reasoning

### Skill Coverage

**Math Domains (4):**
- Heart of Algebra (561 questions)
- Problem Solving and Data Analysis (477 questions)
- Passport to Advanced Math (374 questions)
- Additional Topics in Math (269 questions)

**Reading/Writing Domains (4):**
- Information and Ideas (821 questions)
- Craft and Structure (412 questions)
- Standard English Conventions (357 questions)
- Expression of Ideas

## Tech Stack

- **Backend**: FastAPI (Python 3.11), SQLAlchemy, PostgreSQL, Redis, Celery
- **Frontend**: React 18, Recharts, Tailwind CSS
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Deployment**: Docker, Kubernetes
- **Testing**: Pytest (backend), Jest (frontend)

## Features

### Core Features
- **User Authentication**: JWT-based auth with registration, login, password reset
- **Question Bank**: 3,271 SAT questions with searchable browser and filters
- **Practice Tests**: Digital SAT-style interface with split-pane passages
- **Adaptive Practice**: IRT-based adaptive question selection
- **Assignments**: Tutors can create and assign practice sets to students
- **Progress Tracking**: Per-skill mastery tracking with detailed analytics
- **Tutor Dashboard**: View student progress, common struggles, and analytics

### Security & Production
- Rate limiting on authentication endpoints
- Sentry error monitoring (production)
- Mobile-responsive design with collapsible sidebar
- CORS configured for cross-origin deployment

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git
- PostgreSQL client (optional, for direct database access)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SAT_Tool
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   make up
   ```

4. **Import question bank** (if not already imported)
   ```bash
   cd backend
   python scripts/import_questions.py --all
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/api/docs

### Database Access

Connect to the database directly:
```bash
psql postgresql://sat_user:sat_password@localhost:5433/sat_tutor
```

Example queries:
```sql
-- Count questions by subject
SELECT subject_area, COUNT(*) FROM questions GROUP BY subject_area;

-- Find questions with graphs
SELECT external_id, difficulty FROM questions WHERE prompt_html LIKE '%<svg%';

-- Get questions by skill
SELECT q.external_id, s.name as skill
FROM questions q
JOIN skills s ON q.skill_id = s.id
WHERE s.code = 'H.D.';
```

### Development Commands

```bash
# Start all services
make up

# Stop all services
make down

# View logs
make logs

# Run backend tests
make test-backend

# Run frontend tests
make test-frontend

# Open backend shell
make shell-backend

# Open database shell
make shell-db

# Run database migrations
make migrate

# Create new migration
make migrate-create MSG="add users table"

# Import questions from College Board
cd backend && python scripts/import_questions.py --all

# Re-fetch questions from College Board API
cd backend && python scripts/fetch_math.py
cd backend && python scripts/fetch_reading.py
```

## Project Structure

```
SAT_Tool/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── config.py          # Configuration settings
│   │   ├── database.py        # Database connection
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── api/               # API route handlers
│   │   ├── services/          # Business logic services
│   │   └── tests/             # Pytest tests
│   ├── alembic/               # Database migrations
│   ├── data/                  # Question bank JSON files
│   │   ├── math_core.json     # Raw math data from College Board
│   │   ├── math_norm.json     # Normalized math questions
│   │   ├── reading_core.json  # Raw reading data from College Board
│   │   └── reading_norm.json  # Normalized reading questions
│   ├── scripts/               # Utility scripts
│   │   ├── fetch_math.py      # Fetch math questions from CB API
│   │   ├── fetch_reading.py   # Fetch reading questions from CB API
│   │   └── import_questions.py # Import questions to database
│   ├── docs/                  # Backend documentation
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/        # Reusable UI components
│   │   │   ├── tutor/         # Tutor dashboard
│   │   │   ├── student/       # Student test interface
│   │   │   └── auth/          # Authentication
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── hooks/             # Custom hooks
│   │   └── utils/             # Utilities
│   ├── public/
│   ├── Dockerfile.dev
│   └── package.json
│
├── data/                       # Shared data files (gitignored)
├── k8s/                        # Kubernetes configs
├── docker-compose.yml
├── Makefile
└── README.md
```

## Database Schema

The database consists of 13 tables organized into four main areas:

### Question Bank
- `questions` - 3,271 SAT questions with HTML content, explanations, and metadata
- `domains` - 8 content domains (4 Math, 4 Reading/Writing)
- `subdomains` - Second-level classification (not currently populated)
- `skills` - 29 granular skill categories
- `question_versions` - Version history for audit trail
- `question_relations` - Links between similar/prerequisite questions

### User Management
- `users` - Students, tutors, and administrators

### Student Progress
- `student_responses` - Individual question answers with timing and correctness
- `student_skills` - Mastery level per skill with IRT estimates

### Test System
- `test_sessions` - Practice and assigned tests
- `test_questions` - Questions within a test session
- `assignments` - Tutor-created assignments
- `assignment_questions` - Questions within an assignment

See `backend/docs/DATABASE.md` for complete schema documentation.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration (rate limited: 5/min)
- `POST /api/v1/auth/login` - User login (rate limited: 10/min)
- `POST /api/v1/auth/refresh` - Token refresh (rate limited: 30/min)
- `GET /api/v1/auth/me` - Get current user profile
- `PATCH /api/v1/auth/me` - Update current user profile
- `POST /api/v1/auth/forgot-password` - Request password reset (rate limited: 3/min)
- `POST /api/v1/auth/reset-password` - Reset password with token (rate limited: 5/min)

### Questions
- `GET /api/v1/questions` - List questions (with filters: subject, domain, skill, difficulty)
- `GET /api/v1/questions/{id}` - Get question with explanation
- `GET /api/v1/questions/random` - Get random questions

### Taxonomy
- `GET /api/v1/domains` - List all domains with question counts
- `GET /api/v1/skills` - List all skills with question counts
- `GET /api/v1/domains/{id}/skills` - List skills in a domain

### Assignments
- `GET /api/v1/assignments` - List assignments
- `POST /api/v1/assignments` - Create assignment
- `GET /api/v1/assignments/{id}` - Get assignment details
- `POST /api/v1/assignments/{id}/start` - Start an assignment
- `POST /api/v1/assignments/{id}/answer` - Submit answer
- `POST /api/v1/assignments/{id}/complete` - Complete assignment

### Adaptive Practice
- `GET /api/v1/adaptive/next-question` - Get next adaptive question
- `POST /api/v1/adaptive/sessions` - Start adaptive session
- `GET /api/v1/adaptive/ability-profile` - Get student's ability profile

### Progress & Analytics
- `GET /api/v1/progress/summary` - Student progress summary
- `GET /api/v1/progress/responses` - Response history
- `GET /api/v1/tutor/analytics` - Tutor analytics dashboard
- `GET /api/v1/tutor/students` - List tutor's students

## Data Import

The question bank is sourced from the College Board Question Bank API. The import process:

1. **Fetch** - Scripts fetch raw question data from College Board API
2. **Normalize** - Raw data is normalized to a consistent format
3. **Import** - Normalized data is imported into PostgreSQL

```bash
# Full refresh from College Board API
cd backend
python scripts/fetch_math.py      # Creates math_core.json and math_norm.json
python scripts/fetch_reading.py   # Creates reading_core.json and reading_norm.json
python scripts/import_questions.py --all  # Imports to database
```

See `backend/docs/DATA_IMPORT.md` for detailed documentation.

## Deployment

### Production (Railway + Vercel)

The platform is deployed with:
- **Backend + Database**: Railway (FastAPI + PostgreSQL)
- **Frontend**: Vercel (React)

#### Environment Variables

**Backend (Railway):**
```
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-frontend.vercel.app
SENTRY_DSN=https://...@sentry.io/... (optional)
```

**Frontend (Vercel):**
```
REACT_APP_API_URL=https://your-backend.railway.app/api/v1
```

#### Deploy Changes

```bash
# Push to trigger automatic deployments
git add . && git commit -m "Your changes"
git push origin main
# Railway and Vercel will auto-deploy from main branch
```

## Testing

### Backend
```bash
# Run all tests
make test-backend

# Run with coverage
docker-compose exec backend pytest -v --cov=app --cov-report=html
```

### Frontend
```bash
# Run all tests
make test-frontend

# Run in watch mode
docker-compose exec frontend npm test
```

## Contributing

1. Create a feature branch
2. Write tests for new functionality
3. Ensure all tests pass
4. Submit a pull request

## License

MIT
