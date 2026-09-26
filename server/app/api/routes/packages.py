from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.schemas.package import PackageResponse
from app.services import packages as package_service

router = APIRouter(prefix="/packages", tags=["packages"])


@router.get("", response_model=list[PackageResponse])
def list_packages(
    session: SessionDep,
    _user: CurrentUser,
    active_only: bool = Query(default=True),
) -> list[PackageResponse]:
    return package_service.list_packages(session, active_only=active_only)
