from fastapi import APIRouter, Query, Response, status

from app.api.deps import AdminUser, CurrentUser, SessionDep
from app.schemas.therapist import (
    DayOverrideResponse,
    DayOverrideUpsert,
    TherapistCreate,
    TherapistResponse,
    TherapistUpdate,
)
from app.services import therapists as therapist_service

router = APIRouter(prefix="/therapists", tags=["therapists"])


@router.get("", response_model=list[TherapistResponse])
def list_therapists(
    session: SessionDep,
    _user: CurrentUser,
    q: str | None = Query(default=None, description="Search name or specialty"),
    include_inactive: bool = Query(default=False),
) -> list[TherapistResponse]:
    """Any authenticated user can list therapists (needed for patient assignment)."""
    return therapist_service.list_therapists(
        session, q=q, include_inactive=include_inactive
    )


@router.post("", response_model=TherapistResponse, status_code=status.HTTP_201_CREATED)
def create_therapist(
    body: TherapistCreate,
    session: SessionDep,
    admin: AdminUser,
) -> TherapistResponse:
    return therapist_service.create_therapist(session, body, admin)


@router.get("/{therapist_id}", response_model=TherapistResponse)
def get_therapist(
    therapist_id: int,
    session: SessionDep,
    _user: CurrentUser,
) -> TherapistResponse:
    therapist = therapist_service.get_therapist(session, therapist_id)
    return therapist_service.to_response(session, therapist)


@router.patch("/{therapist_id}", response_model=TherapistResponse)
def update_therapist(
    therapist_id: int,
    body: TherapistUpdate,
    session: SessionDep,
    admin: AdminUser,
) -> TherapistResponse:
    return therapist_service.update_therapist(session, therapist_id, body, admin)


@router.delete("/{therapist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_therapist(
    therapist_id: int,
    session: SessionDep,
    admin: AdminUser,
) -> Response:
    therapist_service.delete_therapist(session, therapist_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{therapist_id}/overrides", response_model=list[DayOverrideResponse])
def list_overrides(
    therapist_id: int,
    session: SessionDep,
    _admin: AdminUser,
) -> list[DayOverrideResponse]:
    return therapist_service.list_overrides(session, therapist_id)


@router.put("/{therapist_id}/overrides", response_model=DayOverrideResponse)
def upsert_override(
    therapist_id: int,
    body: DayOverrideUpsert,
    session: SessionDep,
    admin: AdminUser,
) -> DayOverrideResponse:
    return therapist_service.upsert_override(session, therapist_id, body, admin)


@router.delete(
    "/{therapist_id}/overrides/{override_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_override(
    therapist_id: int,
    override_id: int,
    session: SessionDep,
    admin: AdminUser,
) -> Response:
    therapist_service.delete_override(session, therapist_id, override_id, admin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
