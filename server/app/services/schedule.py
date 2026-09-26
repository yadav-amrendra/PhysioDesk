from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.models.appointment import Appointment
from app.models.enums import AppointmentStatus, PaymentMethod
from app.models.patient import Patient
from app.models.therapist import Therapist, TherapistDayOverride
from app.models.user import User
from app.schemas.schedule import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
    ScheduleDayResponse,
    ScheduleSlot,
    ScheduleTherapistColumn,
)
from app.services.activity import log_activity
from app.services.therapists import working_days_from_str


class ScheduleError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(status_code=status_code, detail=detail)


# Day board draws a fixed 15-minute axis; open/booked blocks span multiple rows
# by their real duration (30 → 2 rows, 45 → 3 rows).
GRID_STEP_MINUTES = 15
CLINIC_SLOT_MINUTES = 30  # default therapist slot length in seed data


def _iso_weekday(d: date) -> int:
    """Monday=1 … Sunday=7."""
    return d.isoweekday()


def resolve_day_window(
    session: Session,
    therapist: Therapist,
    on_date: date,
) -> tuple[bool, time | None, time | None]:
    """
    Returns (is_day_off, start, end).
    If day off or not a working day: (True, None, None).
    """
    override = session.exec(
        select(TherapistDayOverride)
        .where(TherapistDayOverride.therapist_id == therapist.id)
        .where(TherapistDayOverride.override_date == on_date)
    ).first()

    if override is not None:
        if override.is_day_off:
            return True, None, None
        return False, override.start_time, override.end_time

    days = working_days_from_str(therapist.working_days)
    if _iso_weekday(on_date) not in days:
        return True, None, None

    return False, therapist.default_start_time, therapist.default_end_time


def generate_slot_starts(start: time, end: time, duration_minutes: int) -> list[tuple[time, time]]:
    if duration_minutes <= 0 or end <= start:
        return []
    slots: list[tuple[time, time]] = []
    cursor = datetime.combine(date.today(), start)
    end_dt = datetime.combine(date.today(), end)
    delta = timedelta(minutes=duration_minutes)
    while cursor + delta <= end_dt:
        slot_end = cursor + delta
        slots.append((cursor.time().replace(microsecond=0), slot_end.time().replace(microsecond=0)))
        cursor = slot_end
    return slots


def _time_to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _minutes_to_time(value: int) -> time:
    return time(value // 60, value % 60)


def generate_uniform_labels(start: time, end: time, step_minutes: int = 15) -> list[time]:
    """Even time axis for the day grid (independent of each therapist's slot length)."""
    if step_minutes <= 0 or end <= start:
        return []
    labels: list[time] = []
    cursor = _time_to_minutes(start)
    end_m = _time_to_minutes(end)
    while cursor < end_m:
        labels.append(_minutes_to_time(cursor))
        cursor += step_minutes
    return labels


def _active_appointment_statuses() -> list[AppointmentStatus]:
    return [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW]


def _to_appointment_response(
    session: Session,
    appt: Appointment,
    *,
    patient_name: str | None = None,
    therapist_name: str | None = None,
) -> AppointmentResponse:
    if patient_name is None:
        patient = session.get(Patient, appt.patient_id)
        patient_name = patient.full_name if patient else "—"
    if therapist_name is None:
        therapist = session.get(Therapist, appt.therapist_id)
        therapist_name = therapist.full_name if therapist else "—"
    return AppointmentResponse(
        id=appt.id,  # type: ignore[arg-type]
        patient_id=appt.patient_id,
        patient_name=patient_name,
        therapist_id=appt.therapist_id,
        therapist_name=therapist_name,
        appointment_date=appt.appointment_date,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        payment_method=appt.payment_method,
        notes=appt.notes,
    )


def list_appointments(
    session: Session,
    *,
    date_from: date,
    date_to: date,
    therapist_id: int | None = None,
    patient_id: int | None = None,
    status_filter: AppointmentStatus | None = None,
) -> list[AppointmentResponse]:
    if date_to < date_from:
        raise ScheduleError("date_to must be on or after date_from")

    statement = (
        select(Appointment)
        .where(Appointment.appointment_date >= date_from)
        .where(Appointment.appointment_date <= date_to)
    )
    if therapist_id is not None:
        statement = statement.where(Appointment.therapist_id == therapist_id)
    if patient_id is not None:
        statement = statement.where(Appointment.patient_id == patient_id)
    if status_filter is not None:
        statement = statement.where(Appointment.status == status_filter)

    statement = statement.order_by(
        col(Appointment.appointment_date),
        col(Appointment.start_time),
    )
    appointments = list(session.exec(statement).all())

    patient_ids = {a.patient_id for a in appointments}
    therapist_ids = {a.therapist_id for a in appointments}
    patients = {
        p.id: p.full_name
        for p in session.exec(select(Patient).where(col(Patient.id).in_(patient_ids))).all()
        if p.id is not None
    } if patient_ids else {}
    therapists = {
        t.id: t.full_name
        for t in session.exec(select(Therapist).where(col(Therapist.id).in_(therapist_ids))).all()
        if t.id is not None
    } if therapist_ids else {}

    return [
        _to_appointment_response(
            session,
            a,
            patient_name=patients.get(a.patient_id, "—"),
            therapist_name=therapists.get(a.therapist_id, "—"),
        )
        for a in appointments
    ]


def get_day_schedule(
    session: Session,
    on_date: date,
    *,
    therapist_id: int | None = None,
) -> ScheduleDayResponse:
    statement = (
        select(Therapist)
        .where(Therapist.is_active == True)  # noqa: E712
        .order_by(Therapist.full_name)
    )
    if therapist_id is not None:
        statement = statement.where(Therapist.id == therapist_id)
    therapists = list(session.exec(statement).all())

    appointments = session.exec(
        select(Appointment)
        .where(Appointment.appointment_date == on_date)
        .where(col(Appointment.status).in_(_active_appointment_statuses()))
    ).all()
    if therapist_id is not None:
        appointments = [a for a in appointments if a.therapist_id == therapist_id]

    patient_ids = {a.patient_id for a in appointments}
    patients = {
        p.id: p.full_name
        for p in session.exec(select(Patient).where(col(Patient.id).in_(patient_ids))).all()
        if p.id is not None
    } if patient_ids else {}

    by_therapist: dict[int, dict[time, Appointment]] = {}
    for a in appointments:
        by_therapist.setdefault(a.therapist_id, {})[a.start_time] = a

    windows: dict[int, tuple[bool, time | None, time | None]] = {}
    working: list[Therapist] = []
    earliest: time | None = None
    latest: time | None = None
    for therapist in therapists:
        assert therapist.id is not None
        is_off, win_start, win_end = resolve_day_window(session, therapist, on_date)
        windows[therapist.id] = (is_off, win_start, win_end)
        if not is_off and win_start is not None and win_end is not None:
            working.append(therapist)
            if earliest is None or win_start < earliest:
                earliest = win_start
            if latest is None or win_end > latest:
                latest = win_end

    if earliest is None or latest is None:
        for a in appointments:
            if earliest is None or a.start_time < earliest:
                earliest = a.start_time
            if latest is None or a.end_time > latest:
                latest = a.end_time

    # Fixed 15-minute axis for every day board. Slot blocks span N rows by duration.
    step_minutes = GRID_STEP_MINUTES
    if len(working) == 1:
        earliest = windows[working[0].id][1] or earliest
        latest = windows[working[0].id][2] or latest

    labels = (
        generate_uniform_labels(earliest, latest, step_minutes)
        if earliest is not None and latest is not None
        else []
    )
    label_set = set(labels)

    columns: list[ScheduleTherapistColumn] = []
    for therapist in therapists:
        assert therapist.id is not None
        is_off, win_start, win_end = windows[therapist.id]
        duration = therapist.slot_duration_minutes
        booked_map = by_therapist.get(therapist.id, {})
        slots: list[ScheduleSlot] = []

        if is_off or win_start is None or win_end is None:
            for label in labels:
                appt = booked_map.get(label)
                if appt is not None:
                    slots.append(
                        ScheduleSlot(
                            start_time=appt.start_time,
                            end_time=appt.end_time,
                            state="booked",
                            appointment=_to_appointment_response(
                                session,
                                appt,
                                patient_name=patients.get(appt.patient_id, "—"),
                                therapist_name=therapist.full_name,
                            ),
                        )
                    )
                else:
                    slots.append(
                        ScheduleSlot(
                            start_time=label,
                            end_time=label,
                            state="off",
                            appointment=None,
                        )
                    )
            columns.append(
                ScheduleTherapistColumn(
                    id=therapist.id,
                    full_name=therapist.full_name,
                    specialty=therapist.specialty,
                    is_day_off=True,
                    start_time=None,
                    end_time=None,
                    slot_duration_minutes=duration,
                    slots=slots,
                )
            )
            continue

        valid_starts = {
            start_t: end_t
            for start_t, end_t in generate_slot_starts(win_start, win_end, duration)
        }

        for label in labels:
            appt = booked_map.get(label)
            if appt is not None:
                slots.append(
                    ScheduleSlot(
                        start_time=appt.start_time,
                        end_time=appt.end_time,
                        state="booked",
                        appointment=_to_appointment_response(
                            session,
                            appt,
                            patient_name=patients.get(appt.patient_id, "—"),
                            therapist_name=therapist.full_name,
                        ),
                    )
                )
            elif label in valid_starts:
                slots.append(
                    ScheduleSlot(
                        start_time=label,
                        end_time=valid_starts[label],
                        state="open",
                        appointment=None,
                    )
                )
            else:
                slots.append(
                    ScheduleSlot(
                        start_time=label,
                        end_time=label,
                        state="off",
                        appointment=None,
                    )
                )

        # Bookings that do not land on the uniform axis
        for start_t, appt in booked_map.items():
            if start_t in label_set:
                continue
            labels.append(start_t)
            label_set.add(start_t)
            slots.append(
                ScheduleSlot(
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    state="booked",
                    appointment=_to_appointment_response(
                        session,
                        appt,
                        patient_name=patients.get(appt.patient_id, "—"),
                        therapist_name=therapist.full_name,
                    ),
                )
            )

        slots.sort(key=lambda s: s.start_time)
        columns.append(
            ScheduleTherapistColumn(
                id=therapist.id,
                full_name=therapist.full_name,
                specialty=therapist.specialty,
                is_day_off=False,
                start_time=win_start,
                end_time=win_end,
                slot_duration_minutes=duration,
                slots=slots,
            )
        )

    labels = sorted(label_set)

    # Ensure every column has a slot row for every label
    rebuilt: list[ScheduleTherapistColumn] = []
    for column in columns:
        by_start = {s.start_time: s for s in column.slots}
        rebuilt_slots = []
        for label in labels:
            existing = by_start.get(label)
            if existing is not None:
                rebuilt_slots.append(existing)
            else:
                rebuilt_slots.append(
                    ScheduleSlot(
                        start_time=label,
                        end_time=label,
                        state="off",
                        appointment=None,
                    )
                )
        rebuilt.append(
            ScheduleTherapistColumn(
                id=column.id,
                full_name=column.full_name,
                specialty=column.specialty,
                is_day_off=column.is_day_off,
                start_time=column.start_time,
                end_time=column.end_time,
                slot_duration_minutes=column.slot_duration_minutes,
                slots=rebuilt_slots,
            )
        )

    return ScheduleDayResponse(date=on_date, time_labels=labels, therapists=rebuilt)



def _assert_slot_available(
    session: Session,
    *,
    therapist: Therapist,
    on_date: date,
    start_time: time,
    exclude_appointment_id: int | None = None,
) -> time:
    """Validate availability; return computed end_time."""
    is_off, win_start, win_end = resolve_day_window(session, therapist, on_date)
    if is_off or win_start is None or win_end is None:
        raise ScheduleError("Therapist is off on this date")

    duration = therapist.slot_duration_minutes
    valid = generate_slot_starts(win_start, win_end, duration)
    match = next((pair for pair in valid if pair[0] == start_time), None)
    if match is None:
        raise ScheduleError("Selected time is outside the therapist's available slots")

    end_time = match[1]

    statement = (
        select(Appointment)
        .where(Appointment.therapist_id == therapist.id)
        .where(Appointment.appointment_date == on_date)
        .where(Appointment.start_time == start_time)
        .where(col(Appointment.status) != AppointmentStatus.CANCELLED)
    )
    existing = session.exec(statement).first()
    if existing is not None and existing.id != exclude_appointment_id:
        raise ScheduleError("Slot already booked", status.HTTP_409_CONFLICT)

    return end_time


def create_appointment(
    session: Session,
    data: AppointmentCreate,
    actor: User,
) -> AppointmentResponse:
    patient = session.get(Patient, data.patient_id)
    if patient is None:
        raise ScheduleError("Patient not found", status.HTTP_404_NOT_FOUND)

    therapist = session.get(Therapist, data.therapist_id)
    if therapist is None or not therapist.is_active:
        raise ScheduleError("Therapist not found or inactive", status.HTTP_404_NOT_FOUND)

    end_time = _assert_slot_available(
        session,
        therapist=therapist,
        on_date=data.appointment_date,
        start_time=data.start_time,
    )

    appt = Appointment(
        patient_id=data.patient_id,
        therapist_id=data.therapist_id,
        appointment_date=data.appointment_date,
        start_time=data.start_time,
        end_time=end_time,
        status=AppointmentStatus.BOOKED,
        payment_method=data.payment_method,
        notes=data.notes.strip() if data.notes else None,
    )
    session.add(appt)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise ScheduleError("Slot already booked", status.HTTP_409_CONFLICT) from exc

    log_activity(
        session,
        actor=actor,
        action="appointment.booked",
        entity_type="appointment",
        entity_id=appt.id,
        summary=(
            f"Booked {patient.full_name} with {therapist.full_name} "
            f"on {data.appointment_date} at {data.start_time.strftime('%H:%M')}"
        ),
    )
    session.commit()
    session.refresh(appt)
    return _to_appointment_response(
        session,
        appt,
        patient_name=patient.full_name,
        therapist_name=therapist.full_name,
    )


def get_appointment(session: Session, appointment_id: int) -> AppointmentResponse:
    appt = session.get(Appointment, appointment_id)
    if appt is None:
        raise ScheduleError("Appointment not found", status.HTTP_404_NOT_FOUND)
    return _to_appointment_response(session, appt)


def update_appointment(
    session: Session,
    appointment_id: int,
    data: AppointmentUpdate,
    actor: User,
) -> AppointmentResponse:
    appt = session.get(Appointment, appointment_id)
    if appt is None:
        raise ScheduleError("Appointment not found", status.HTTP_404_NOT_FOUND)

    payload = data.model_dump(exclude_unset=True)
    if not payload:
        return _to_appointment_response(session, appt)

    if appt.status == AppointmentStatus.CANCELLED and "status" not in payload:
        raise ScheduleError("Cannot edit a cancelled appointment")

    new_therapist_id = payload.get("therapist_id", appt.therapist_id)
    new_date = payload.get("appointment_date", appt.appointment_date)
    new_start = payload.get("start_time", appt.start_time)

    slot_changing = any(k in payload for k in ("therapist_id", "appointment_date", "start_time"))
    if slot_changing:
        therapist = session.get(Therapist, new_therapist_id)
        if therapist is None or not therapist.is_active:
            raise ScheduleError("Therapist not found or inactive", status.HTTP_404_NOT_FOUND)
        end_time = _assert_slot_available(
            session,
            therapist=therapist,
            on_date=new_date,
            start_time=new_start,
            exclude_appointment_id=appt.id,
        )
        appt.therapist_id = new_therapist_id
        appt.appointment_date = new_date
        appt.start_time = new_start
        appt.end_time = end_time
        if appt.status == AppointmentStatus.CANCELLED:
            appt.status = AppointmentStatus.BOOKED

    if "payment_method" in payload:
        appt.payment_method = payload["payment_method"]
    if "notes" in payload:
        notes = payload["notes"]
        appt.notes = notes.strip() if isinstance(notes, str) and notes else notes
    if "status" in payload:
        appt.status = payload["status"]

    session.add(appt)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise ScheduleError("Slot already booked", status.HTTP_409_CONFLICT) from exc

    action = "appointment.rescheduled" if slot_changing else "appointment.updated"
    log_activity(
        session,
        actor=actor,
        action=action,
        entity_type="appointment",
        entity_id=appt.id,
        summary=f"Updated appointment #{appt.id}",
    )
    session.commit()
    session.refresh(appt)
    return _to_appointment_response(session, appt)


def cancel_appointment(session: Session, appointment_id: int, actor: User) -> AppointmentResponse:
    appt = session.get(Appointment, appointment_id)
    if appt is None:
        raise ScheduleError("Appointment not found", status.HTTP_404_NOT_FOUND)
    if appt.status == AppointmentStatus.CANCELLED:
        return _to_appointment_response(session, appt)

    appt.status = AppointmentStatus.CANCELLED
    session.add(appt)
    log_activity(
        session,
        actor=actor,
        action="appointment.cancelled",
        entity_type="appointment",
        entity_id=appt.id,
        summary=f"Cancelled appointment #{appt.id}",
    )
    session.commit()
    session.refresh(appt)
    return _to_appointment_response(session, appt)
