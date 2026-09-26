from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.schemas.activity import ActivityLogResponse
from app.schemas.pagination import Page
from app.services import activity as activity_service

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=Page[ActivityLogResponse])
def list_activity(
    session: SessionDep,
    _user: CurrentUser,
    q: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[ActivityLogResponse]:
    return activity_service.list_activity_logs(
        session,
        q=q,
        entity_type=entity_type,
        action=action,
        page=page,
        page_size=page_size,
    )
