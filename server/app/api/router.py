from fastapi import APIRouter

from app.api.routes import auth, health, therapists

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(therapists.router)
