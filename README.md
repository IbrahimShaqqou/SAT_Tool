# SAT Tutoring Platform

A production-ready Digital SAT tutoring platform with skill-level tracking, adaptive practice tests, and tutor analytics.

## Tech Stack

- **Backend**: FastAPI (Python 3.11), SQLAlchemy, PostgreSQL, Redis, Celery
- **Frontend**: React 18, Recharts, Tailwind CSS
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Deployment**: Docker, Kubernetes
- **Testing**: Pytest (backend), Jest (frontend)

## Features

### Phase 1 (MVP)
- User authentication (JWT)
- Question bank management
- Practice test system (matching Digital SAT interface)
- Skill-level progress tracking
- Tutor analytics dashboard

### Phase 2
- IRT adaptive engine
- Assignment system
- Recommendation engine

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SAT
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

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/api/docs

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
```

## Project Structure

```
SAT/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── config.py          # Configuration settings
│   │   ├── database.py        # Database connection
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── api/               # API route handlers
│   │   ├── core/              # Business logic
│   │   └── tests/             # Pytest tests
│   ├── alembic/               # Database migrations
│   ├── scripts/               # Utility scripts
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
├── data/                       # Data files (gitignored)
├── k8s/                        # Kubernetes configs
├── docker-compose.yml
├── Makefile
└── README.md
```

## Database Schema

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

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh

### Questions
- `GET /api/v1/questions` - List questions
- `POST /api/v1/questions` - Create question
- `GET /api/v1/questions/{id}` - Get question

### Tests
- `POST /api/v1/tests` - Create practice test
- `GET /api/v1/tests/{id}` - Get test
- `POST /api/v1/tests/{id}/submit` - Submit test

### Analytics
- `GET /api/v1/analytics/student/{id}` - Student progress
- `GET /api/v1/analytics/skills` - Skill breakdown

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
