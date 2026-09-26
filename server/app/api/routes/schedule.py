from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.models.enums import AppointmentStatus
from app.schemas.schedule import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
    ScheduleDayResponse,
)
from app.services import schedule as schedule_service

router = APIRouter(tags=["schedule"])


@router.get("/schedule/day", response_model=ScheduleDayResponse)
def get_schedule_day(
    session: SessionDep,
    _user: CurrentUser,
    on_date: date = Query(..., alias="date"),
    therapist_id: int | None = Query(default=None),
) -> ScheduleDayResponse:
    return schedule_service.get_day_schedule(
        session, on_date, therapist_id=therapist_id
    )


@router.get("/appointments", response_model=list[AppointmentResponse])
def list_appointments(
    session: SessionDep,
    _user: CurrentUser,
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    therapist_id: int | None = Query(default=None),
    patient_id: int | None = Query(default=None),
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
) -> list[AppointmentResponse]:
    return schedule_service.list_appointments(
        session,
        date_from=date_from,
        date_to=date_to,
        therapist_id=therapist_id,
        patient_id=patient_id,
        status_filter=status_filter,
    )


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def book_appointment(
    body: AppointmentCreate,
    session: SessionDep,
    user: CurrentUser,
) -> AppointmentResponse:
    return schedule_service.create_appointment(session, body, user)


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    session: SessionDep,
    _user: CurrentUser,
) -> AppointmentResponse:
    return schedule_service.get_appointment(session, appointment_id)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    body: AppointmentUpdate,
    session: SessionDep,
    user: CurrentUser,
) -> AppointmentResponse:
    return schedule_service.update_appointment(session, appointment_id, body, user)


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: int,
    session: SessionDep,
    user: CurrentUser,
) -> AppointmentResponse:
    return schedule_service.cancel_appointment(session, appointment_id, user)
