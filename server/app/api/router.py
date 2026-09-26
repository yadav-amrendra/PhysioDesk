from fastapi import APIRouter

from app.api.routes import auth, health, packages, patients, therapists

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(therapists.router)
api_router.include_router(packages.router)
api_router.include_router(patients.router)
