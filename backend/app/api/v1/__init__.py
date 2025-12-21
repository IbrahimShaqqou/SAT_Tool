"""
SAT Tutoring Platform - API Version 1

All v1 API routers are exported from here.
"""

from fastapi import APIRouter

from app.api.v1 import auth

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Future routers will be added here:
# api_router.include_router(questions.router, prefix="/questions", tags=["Questions"])
# api_router.include_router(tests.router, prefix="/tests", tags=["Tests"])
# api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
