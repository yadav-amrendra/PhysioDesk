from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import SessionDep
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check(session: SessionDep) -> HealthResponse:
    """Liveness + database connectivity check."""
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc

    return HealthResponse(
        status="ok",
        database="connected",
        app=settings.app_name,
        version=settings.app_version,
    )
