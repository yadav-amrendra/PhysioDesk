from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, SessionDep
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
) -> ScheduleDayResponse:
    return schedule_service.get_day_schedule(session, on_date)


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
