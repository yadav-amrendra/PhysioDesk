from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlmodel import Session, col, func, or_, select

from app.models.appointment import Appointment
from app.models.enums import AppointmentStatus
from app.models.therapist import Therapist, TherapistDayOverride
from app.models.user import User
from app.schemas.therapist import (
    DayOverrideResponse,
    DayOverrideUpsert,
    TherapistCreate,
    TherapistResponse,
    TherapistUpdate,
)
from app.services.activity import log_activity


class TherapistError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=status_code, detail=detail)


def working_days_to_str(days: list[int]) -> str:
    return ",".join(str(d) for d in sorted(set(days)))


def working_days_from_str(raw: str) -> list[int]:
    if not raw.strip():
        return []
    return [int(part) for part in raw.split(",") if part.strip()]


def compute_weekly_hours(therapist: Therapist) -> Decimal:
    days = working_days_from_str(therapist.working_days)
    if not days:
        return Decimal("0.00")
    start = datetime.combine(date.today(), therapist.default_start_time)
    end = datetime.combine(date.today(), therapist.default_end_time)
    if end <= start:
        return Decimal("0.00")
    hours_per_day = Decimal(str((end - start).total_seconds() / 3600))
    return (hours_per_day * len(days)).quantize(Decimal("0.01"))


def patients_seen_today(session: Session, therapist_id: int, today: date | None = None) -> int:
    day = today or date.today()
    statement = (
        select(func.count())
        .select_from(Appointment)
        .where(Appointment.therapist_id == therapist_id)
        .where(Appointment.appointment_date == day)
        .where(
            col(Appointment.status).in_(
                [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED]
            )
        )
    )
    return int(session.exec(statement).one())


def to_response(session: Session, therapist: Therapist) -> TherapistResponse:
    return TherapistResponse(
        id=therapist.id,  # type: ignore[arg-type]
        full_name=therapist.full_name,
        specialty=therapist.specialty,
        working_days=working_days_from_str(therapist.working_days),
        default_start_time=therapist.default_start_time,
        default_end_time=therapist.default_end_time,
        slot_duration_minutes=therapist.slot_duration_minutes,
        is_active=therapist.is_active,
        weekly_hours=compute_weekly_hours(therapist),
        patients_seen_today=patients_seen_today(session, therapist.id),  # type: ignore[arg-type]
    )


def list_therapists(
    session: Session,
    *,
    q: str | None = None,
    include_inactive: bool = False,
) -> list[TherapistResponse]:
    statement = select(Therapist)
    if not include_inactive:
        statement = statement.where(Therapist.is_active == True)  # noqa: E712
    if q:
        pattern = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                col(Therapist.full_name).ilike(pattern),
                col(Therapist.specialty).ilike(pattern),
            )
        )
    statement = statement.order_by(Therapist.full_name)
    therapists = session.exec(statement).all()
    return [to_response(session, t) for t in therapists]


def get_therapist(session: Session, therapist_id: int) -> Therapist:
    therapist = session.get(Therapist, therapist_id)
    if therapist is None:
        raise TherapistError("Therapist not found", status.HTTP_404_NOT_FOUND)
    return therapist


def create_therapist(
    session: Session,
    data: TherapistCreate,
    actor: User,
) -> TherapistResponse:
    therapist = Therapist(
        full_name=data.full_name.strip(),
        specialty=data.specialty.strip(),
        working_days=working_days_to_str(data.working_days),
        default_start_time=data.default_start_time,
        default_end_time=data.default_end_time,
        slot_duration_minutes=data.slot_duration_minutes,
        is_active=data.is_active,
    )
    session.add(therapist)
    session.flush()
    log_activity(
        session,
        actor=actor,
        action="therapist.created",
        entity_type="therapist",
        entity_id=therapist.id,
        summary=f"Created therapist {therapist.full_name}",
    )
    session.commit()
    session.refresh(therapist)
    return to_response(session, therapist)


def update_therapist(
    session: Session,
    therapist_id: int,
    data: TherapistUpdate,
    actor: User,
) -> TherapistResponse:
    therapist = get_therapist(session, therapist_id)
    payload = data.model_dump(exclude_unset=True)

    if "working_days" in payload and payload["working_days"] is not None:
        payload["working_days"] = working_days_to_str(payload["working_days"])

    start = payload.get("default_start_time", therapist.default_start_time)
    end = payload.get("default_end_time", therapist.default_end_time)
    if end <= start:
        raise TherapistError("default_end_time must be after default_start_time")

    for key, value in payload.items():
        if key in {"full_name", "specialty"} and isinstance(value, str):
            value = value.strip()
        setattr(therapist, key, value)

    session.add(therapist)
    log_activity(
        session,
        actor=actor,
        action="therapist.updated",
        entity_type="therapist",
        entity_id=therapist.id,
        summary=f"Updated therapist {therapist.full_name}",
    )
    session.commit()
    session.refresh(therapist)
    return to_response(session, therapist)


def delete_therapist(session: Session, therapist_id: int, actor: User) -> None:
    """Soft-delete: deactivate therapist; appointments remain."""
    therapist = get_therapist(session, therapist_id)
    if not therapist.is_active:
        return
    therapist.is_active = False
    session.add(therapist)
    log_activity(
        session,
        actor=actor,
        action="therapist.deactivated",
        entity_type="therapist",
        entity_id=therapist.id,
        summary=f"Deactivated therapist {therapist.full_name}",
    )
    session.commit()


def list_overrides(session: Session, therapist_id: int) -> list[DayOverrideResponse]:
    get_therapist(session, therapist_id)
    statement = (
        select(TherapistDayOverride)
        .where(TherapistDayOverride.therapist_id == therapist_id)
        .order_by(TherapistDayOverride.override_date)
    )
    rows = session.exec(statement).all()
    return [DayOverrideResponse.model_validate(row) for row in rows]


def upsert_override(
    session: Session,
    therapist_id: int,
    data: DayOverrideUpsert,
    actor: User,
) -> DayOverrideResponse:
    therapist = get_therapist(session, therapist_id)
    existing = session.exec(
        select(TherapistDayOverride)
        .where(TherapistDayOverride.therapist_id == therapist_id)
        .where(TherapistDayOverride.override_date == data.override_date)
    ).first()

    if existing:
        existing.is_day_off = data.is_day_off
        existing.start_time = None if data.is_day_off else data.start_time
        existing.end_time = None if data.is_day_off else data.end_time
        row = existing
        action = "therapist.override_updated"
    else:
        row = TherapistDayOverride(
            therapist_id=therapist_id,
            override_date=data.override_date,
            is_day_off=data.is_day_off,
            start_time=None if data.is_day_off else data.start_time,
            end_time=None if data.is_day_off else data.end_time,
        )
        session.add(row)
        action = "therapist.override_created"

    session.flush()
    summary = (
        f"Day off for {therapist.full_name} on {data.override_date}"
        if data.is_day_off
        else f"Custom hours for {therapist.full_name} on {data.override_date}"
    )
    log_activity(
        session,
        actor=actor,
        action=action,
        entity_type="therapist",
        entity_id=therapist_id,
        summary=summary,
        metadata={"override_date": str(data.override_date), "is_day_off": data.is_day_off},
    )
    session.commit()
    session.refresh(row)
    return DayOverrideResponse.model_validate(row)


def delete_override(
    session: Session,
    therapist_id: int,
    override_id: int,
    actor: User,
) -> None:
    therapist = get_therapist(session, therapist_id)
    row = session.get(TherapistDayOverride, override_id)
    if row is None or row.therapist_id != therapist_id:
        raise TherapistError("Override not found", status.HTTP_404_NOT_FOUND)
    override_date = row.override_date
    session.delete(row)
    log_activity(
        session,
        actor=actor,
        action="therapist.override_deleted",
        entity_type="therapist",
        entity_id=therapist_id,
        summary=f"Removed schedule override for {therapist.full_name} on {override_date}",
    )
    session.commit()


