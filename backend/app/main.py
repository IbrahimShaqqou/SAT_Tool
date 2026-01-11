"""
SAT Tutoring Platform - FastAPI Application

Main application entry point with CORS configuration and health check endpoint.
"""

import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.api.v1 import api_router
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

# Initialize Sentry for error monitoring (only in production with DSN configured)
if settings.sentry_dsn and settings.environment == "production":
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
        profiles_sample_rate=0.1,  # 10% of sampled transactions for profiling
    )

# Create FastAPI application
app = FastAPI(
    title="ZooPrep API",
    description="API for Digital SAT practice and tutoring with skill-level tracking",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Configure rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Configure CORS - must be before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler to ensure errors are logged and CORS headers work
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Handle all unhandled exceptions with proper logging.
    CORS middleware will add headers to this response.
    """
    error_trace = traceback.format_exc()
    print(f"Unhandled exception: {exc}")
    print(f"Request: {request.method} {request.url}")
    print(f"Traceback: {error_trace}")

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "type": type(exc).__name__,
            "message": str(exc) if settings.debug else "An unexpected error occurred",
        }
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
        "service": "zooprep-api",
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
        "message": "ZooPrep API",
        "docs": "/api/docs",
        "health": "/health",
    }


# Include API v1 router
app.include_router(api_router, prefix="/api/v1")
