"""
SAT Tutoring Platform - FastAPI Application

Main application entry point with CORS configuration and health check endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1 import api_router

# Create FastAPI application
app = FastAPI(
    title="SAT Tutoring Platform API",
    description="API for Digital SAT practice and tutoring with skill-level tracking",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """
    Health check endpoint for container orchestration and load balancers.

    Returns:
        dict: Health status with service name and version
    """
    return {
        "status": "healthy",
        "service": "sat-tutor-api",
        "version": "0.1.0",
    }


@app.get("/", tags=["Root"])
async def root() -> dict:
    """
    Root endpoint with API information.

    Returns:
        dict: Welcome message and documentation links
    """
    return {
        "message": "SAT Tutoring Platform API",
        "docs": "/api/docs",
        "health": "/health",
    }


# Include API v1 router
app.include_router(api_router, prefix="/api/v1")
