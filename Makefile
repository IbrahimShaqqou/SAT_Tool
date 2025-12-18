# SAT Tutoring Platform - Makefile
# Common development commands

.PHONY: help up down restart logs shell-backend shell-frontend shell-db test-backend test-frontend migrate clean build

# Default target
help:
	@echo "SAT Tutoring Platform - Available Commands"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make logs            - View all service logs"
	@echo "  make build           - Rebuild all containers"
	@echo "  make clean           - Remove containers, volumes, and images"
	@echo ""
	@echo "Shell Commands:"
	@echo "  make shell-backend   - Open shell in backend container"
	@echo "  make shell-frontend  - Open shell in frontend container"
	@echo "  make shell-db        - Open PostgreSQL shell"
	@echo ""
	@echo "Testing Commands:"
	@echo "  make test-backend    - Run backend tests"
	@echo "  make test-frontend   - Run frontend tests"
	@echo ""
	@echo "Database Commands:"
	@echo "  make migrate         - Run database migrations"
	@echo "  make migrate-create  - Create new migration (MSG=description)"
	@echo ""

# =============================================================================
# Docker Commands
# =============================================================================

up:
	docker-compose up -d
	@echo "Services started. Access:"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/api/docs"

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

build:
	docker-compose build --no-cache

clean:
	docker-compose down -v --rmi local
	@echo "Cleaned up containers, volumes, and images"

# =============================================================================
# Shell Commands
# =============================================================================

shell-backend:
	docker-compose exec backend /bin/bash

shell-frontend:
	docker-compose exec frontend /bin/sh

shell-db:
	docker-compose exec postgres psql -U sat_user -d sat_tutor

# =============================================================================
# Testing Commands
# =============================================================================

test-backend:
	docker-compose exec backend pytest -v --cov=app --cov-report=term-missing

test-frontend:
	docker-compose exec frontend npm test -- --coverage --watchAll=false

# =============================================================================
# Database Commands
# =============================================================================

migrate:
	docker-compose exec backend alembic upgrade head

migrate-create:
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make migrate-create MSG='migration description'"; \
		exit 1; \
	fi
	docker-compose exec backend alembic revision --autogenerate -m "$(MSG)"

migrate-down:
	docker-compose exec backend alembic downgrade -1

# =============================================================================
# Development Helpers
# =============================================================================

# Install backend dependencies locally (for IDE support)
install-backend:
	cd backend && pip install -r requirements.txt

# Install frontend dependencies locally (for IDE support)
install-frontend:
	cd frontend && npm install

# Format backend code
format-backend:
	cd backend && black . && isort .

# Lint frontend code
lint-frontend:
	cd frontend && npm run lint
