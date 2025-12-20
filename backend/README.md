# SAT Tutoring Platform - Backend

FastAPI backend for the SAT Tutoring Platform with PostgreSQL database and Redis caching.

## Overview

The backend provides:
- RESTful API for the SAT tutoring platform
- Question bank management with 3,271 questions
- User authentication and authorization
- Student progress tracking
- Test session management
- Tutor assignment system

## Requirements

- Python 3.11+
- PostgreSQL 15+
- Redis 7+

## Setup

### Using Docker (Recommended)

```bash
# From project root
docker-compose up -d
```

### Local Development

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Run database migrations:
   ```bash
   alembic upgrade head
   ```

5. Import question bank:
   ```bash
   python scripts/import_questions.py --all
   ```

6. Start the server:
   ```bash
   uvicorn app.main:app --reload
   ```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection and session
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── base.py          # Base model mixins
│   │   ├── enums.py         # Enum types
│   │   ├── user.py          # User model
│   │   ├── question.py      # Question models
│   │   ├── taxonomy.py      # Domain, Subdomain, Skill models
│   │   ├── response.py      # StudentResponse, StudentSkill models
│   │   ├── test.py          # TestSession, TestQuestion models
│   │   └── assignment.py    # Assignment models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── api/                 # API route handlers
│   │   └── v1/              # API version 1
│   └── services/            # Business logic
│       └── question_import.py  # Question import service
├── alembic/                 # Database migrations
│   ├── env.py
│   └── versions/
│       └── 001_create_initial_schema.py
├── data/                    # Question bank data files
│   ├── math_core.json       # Raw math data (27 MB)
│   ├── math_norm.json       # Normalized math data (13 MB)
│   ├── reading_core.json    # Raw reading data (6.4 MB)
│   └── reading_norm.json    # Normalized reading data (1.7 MB)
├── scripts/                 # Utility scripts
│   ├── fetch_math.py        # Fetch math questions from College Board
│   ├── fetch_reading.py     # Fetch reading questions from College Board
│   └── import_questions.py  # Import questions to database
├── docs/                    # Documentation
│   ├── DATABASE.md          # Database schema documentation
│   └── DATA_IMPORT.md       # Data import documentation
├── Dockerfile
├── requirements.txt
├── alembic.ini
└── README.md
```

## Configuration

Environment variables (set in `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://sat_user:sat_password@localhost:5433/sat_tutor` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT signing key | (required in production) |
| `DEBUG` | Enable debug mode | `false` |
| `LOG_LEVEL` | Logging level | `INFO` |

## Database

### Connection

```bash
psql postgresql://sat_user:sat_password@localhost:5433/sat_tutor
```

### Tables

| Table | Description | Rows |
|-------|-------------|------|
| `questions` | SAT questions | 3,271 |
| `domains` | Content domains | 8 |
| `skills` | Granular skills | 29 |
| `users` | User accounts | 0 |
| `student_responses` | Answer records | 0 |
| `student_skills` | Mastery tracking | 0 |
| `test_sessions` | Test instances | 0 |
| `test_questions` | Questions in tests | 0 |
| `assignments` | Tutor assignments | 0 |
| `assignment_questions` | Questions in assignments | 0 |
| `question_versions` | Version history | 0 |
| `question_relations` | Related questions | 0 |
| `subdomains` | Subdomain classification | 0 |

### Migrations

```bash
# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# Rollback one migration
alembic downgrade -1
```

## Scripts

### fetch_math.py

Fetches math questions from College Board Question Bank API.

```bash
python scripts/fetch_math.py [--fresh] [--check]
```

Options:
- `--fresh`: Re-download all questions
- `--check`: Only run quality checks on existing data

Outputs:
- `data/math_core.json`: Raw API response data
- `data/math_norm.json`: Normalized question data

### fetch_reading.py

Fetches reading/writing questions from College Board Question Bank API.

```bash
python scripts/fetch_reading.py [--fresh] [--raw]
```

Options:
- `--fresh`: Re-download all questions
- `--raw`: Only create core file, skip normalization

Outputs:
- `data/reading_core.json`: Raw API response data
- `data/reading_norm.json`: Normalized question data

### import_questions.py

Imports normalized questions into PostgreSQL database.

```bash
python scripts/import_questions.py [--math] [--reading] [--all] [--seed-only]
```

Options:
- `--math`: Import only math questions
- `--reading`: Import only reading questions
- `--all`: Import both (default)
- `--seed-only`: Only seed taxonomy domains

## API Documentation

Once the server is running, access:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest app/tests/test_questions.py

# Run with verbose output
pytest -v
```

## Documentation

- [DATABASE.md](docs/DATABASE.md) - Complete database schema documentation
- [DATA_IMPORT.md](docs/DATA_IMPORT.md) - Data import process documentation
