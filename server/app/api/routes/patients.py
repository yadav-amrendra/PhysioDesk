from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, SessionDep
from app.models.enums import PatientStatus
from app.schemas.pagination import Page
from app.schemas.patient import (
    PatientCreate,
    PatientDetailResponse,
    PatientResponse,
    PatientUpdate,
)
from app.services import patients as patient_service

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=Page[PatientResponse])
def list_patients(
    session: SessionDep,
    _user: CurrentUser,
    q: str | None = Query(default=None),
    therapist_id: int | None = Query(default=None),
    status: PatientStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page[PatientResponse]:
    return patient_service.list_patients(
        session,
        q=q,
        therapist_id=therapist_id,
        status_filter=status,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    session: SessionDep,
    user: CurrentUser,
) -> PatientResponse:
    return patient_service.create_patient(session, body, user)


@router.get("/{patient_id}", response_model=PatientDetailResponse)
def get_patient(
    patient_id: int,
    session: SessionDep,
    _user: CurrentUser,
) -> PatientDetailResponse:
    return patient_service.get_patient_detail(session, patient_id)


@router.patch("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    body: PatientUpdate,
    session: SessionDep,
    user: CurrentUser,
) -> PatientResponse:
    return patient_service.update_patient(session, patient_id, body, user)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    patient_id: int,
    session: SessionDep,
    user: CurrentUser,
) -> Response:
    patient_service.delete_patient(session, patient_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
