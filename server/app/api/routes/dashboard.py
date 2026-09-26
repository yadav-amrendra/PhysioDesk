from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard as dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    session: SessionDep,
    _user: CurrentUser,
    on_date: date | None = Query(default=None, alias="date"),
) -> DashboardResponse:
    return dashboard_service.get_dashboard(session, on_date)
