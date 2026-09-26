from fastapi import APIRouter

from app.api.routes import (
    auth,
    billing,
    dashboard,
    health,
    packages,
    patients,
    schedule,
    therapists,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(therapists.router)
api_router.include_router(packages.router)
api_router.include_router(patients.router)
api_router.include_router(schedule.router)
api_router.include_router(billing.router)
