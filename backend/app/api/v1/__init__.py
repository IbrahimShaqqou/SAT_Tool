"""
SAT Tutoring Platform - API Version 1

All v1 API routers are exported from here.
"""

from fastapi import APIRouter

from app.api.v1 import auth, questions, taxonomy, practice, progress, assignments, tutor, assess, adaptive, lessons

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(questions.router, prefix="/questions", tags=["Questions"])
api_router.include_router(taxonomy.router, tags=["Taxonomy"])
api_router.include_router(practice.router, prefix="/practice", tags=["Practice Sessions"])
api_router.include_router(progress.router, prefix="/progress", tags=["Student Progress"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["Assignments"])
api_router.include_router(tutor.router, prefix="/tutor", tags=["Tutor Dashboard"])
api_router.include_router(assess.router, prefix="/assess", tags=["Public Assessment"])
api_router.include_router(adaptive.router, prefix="/adaptive", tags=["Adaptive Testing"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["Skill Lessons"])
