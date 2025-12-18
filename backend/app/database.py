"""
SAT Tutoring Platform - Database Configuration

SQLAlchemy setup with connection pooling and session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings


# Create database engine with connection pooling
engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.debug,
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for all models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency for FastAPI.

    Yields a database session and ensures it's closed after use.

    Yields:
        Session: SQLAlchemy database session

    Example:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database tables.

    Creates all tables defined in models. Use Alembic migrations
    for production database changes.
    """
    # Import all models here to ensure they are registered with Base
    # from app.models import user, question, skill, etc.
    Base.metadata.create_all(bind=engine)
